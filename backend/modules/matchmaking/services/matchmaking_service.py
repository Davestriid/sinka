"""
Motor de matchmaking por afinidad de actividad.

Flujo:
1. El usuario conecta por WebSocket y envia TASK_INFO con su categoria y su tarea
2. join_queue() lo registra en la cola de su categoria y espera
3. Durante los primeros 30 segundos solo se le empareja con alguien de la misma
   categoria. Pasado ese tiempo entra a la cola general y se le empareja con
   quien este disponible, avisandole que su companero trabaja en otra area
4. Ambos reciben MATCHED con el id de sesion, los datos del companero y su tarea
5. El try/finally del router garantiza la limpieza de Redis aunque se corte la conexion

La ventana de espera existe porque dividir la cola en trece categorias podria
dejar esperando de mas a quien entra en un horario de poca actividad. Primero
se busca afinidad, y si no aparece nadie se prioriza que la sesion ocurra.
"""
import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from core.cache import redis_client
from core.catalog import normalize_topic
from core.event_bus import EventBus

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)

QUEUE_KEY = "matchmaking:global_queue"
QUEUE_KEY_TOPIC = "matchmaking:queue:{topic}"

QUEUE_TIMEOUT_SECONDS = 120     # tiempo maximo total en cola
AFFINITY_WINDOW_SECONDS = 30    # cuanto se insiste en buscar la misma categoria
SWEEP_INTERVAL_SECONDS = 3      # cada cuanto se revisa la cola en segundo plano


@dataclass
class MatchResult:
    match_id: str
    partner_id: str
    partner_username: str
    session_id: str
    my_task: dict
    partner_task: dict
    topic: str
    by_affinity: bool


@dataclass
class _WaitEntry:
    websocket: "WebSocket"
    username:  str
    task_info: dict                 # {topic, task_title, target_pomodoros}
    topic:     str
    blocked:   frozenset[str] = frozenset()   # con quienes no debe emparejarse
    joined_at: float = field(default_factory=time.monotonic)
    event:     asyncio.Event = field(default_factory=asyncio.Event)
    result:    MatchResult | None = None

    @property
    def waited(self) -> float:
        return time.monotonic() - self.joined_at

    @property
    def acepta_cualquiera(self) -> bool:
        """True cuando ya paso la ventana de afinidad y acepta cualquier categoria."""
        return self.waited >= AFFINITY_WINDOW_SECONDS


class MatchmakingService:
    """Singleton por proceso. _waiting guarda a los usuarios en cola."""

    def __init__(self) -> None:
        self._waiting: dict[str, _WaitEntry] = {}
        self._sweeper: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Entrada y salida de la cola
    # ------------------------------------------------------------------

    async def join_queue(
        self,
        user_id:   str,
        username:  str,
        task_info: dict,
        websocket: "WebSocket",
        blocked:   frozenset[str] | None = None,
    ) -> MatchResult | None:
        """
        Registra al usuario y espera hasta emparejarlo o agotar el tiempo.
        Devuelve MatchResult si hubo pareja, None si expiro.
        """
        # Si ya figuraba en cola, manda la conexion nueva. La anterior suele ser
        # una pestana cerrada o una conexion caida que no alcanzo a limpiarse:
        # rechazar al usuario lo dejaba atrapado sin poder volver a buscar.
        anterior = self._waiting.get(user_id)
        if anterior is not None:
            logger.info(
                "Matchmaking: %s vuelve a entrar, se descarta su espera anterior", user_id
            )
            anterior.result = None
            anterior.event.set()          # libera la espera vieja
            try:
                await anterior.websocket.close(code=4001)
            except Exception:
                pass                      # ya estaba cerrada
            await self.leave_queue(user_id)

        topic = normalize_topic(task_info.get("topic") or task_info.get("work_area"))
        task_info = {**task_info, "topic": topic}

        entry = _WaitEntry(
            websocket=websocket,
            username=username,
            task_info=task_info,
            topic=topic,
            blocked=blocked or frozenset(),
        )
        self._waiting[user_id] = entry

        await redis_client.rpush(QUEUE_KEY_TOPIC.format(topic=topic), user_id)
        await redis_client.rpush(QUEUE_KEY, user_id)

        en_mi_categoria = sum(1 for e in self._waiting.values() if e.topic == topic)
        await websocket.send_json({
            "type": "QUEUED",
            "payload": {
                "position":         len(self._waiting),
                "topic":            topic,
                "waiting_in_topic": en_mi_categoria,
                "affinity_window":  AFFINITY_WINDOW_SECONDS,
            },
        })
        logger.info(
            "Matchmaking: %s entro a la cola de '%s' (%d en la categoria, %d en total)",
            user_id, topic, en_mi_categoria, len(self._waiting),
        )

        await self._try_match_all()
        self._ensure_sweeper()

        try:
            await asyncio.wait_for(entry.event.wait(), timeout=QUEUE_TIMEOUT_SECONDS)
            return entry.result
        except asyncio.TimeoutError:
            logger.info("Matchmaking: expiro el tiempo de espera de %s", user_id)
            return None

    async def leave_queue(self, user_id: str) -> None:
        """Saca al usuario de la cola. Idempotente, se llama desde el finally del router."""
        entry = self._waiting.pop(user_id, None)
        await redis_client.lrem(QUEUE_KEY, 0, user_id)
        if entry is not None:
            await redis_client.lrem(QUEUE_KEY_TOPIC.format(topic=entry.topic), 0, user_id)
            logger.info("Matchmaking: %s salio de la cola de '%s'", user_id, entry.topic)

    # ------------------------------------------------------------------
    # Emparejamiento
    # ------------------------------------------------------------------

    async def _try_match_all(self) -> None:
        """
        Forma todas las parejas posibles. Primero por afinidad de categoria y
        luego, entre quienes ya esperaron lo suficiente, sin importar la categoria.
        """
        for user_a, user_b, by_affinity in self._buscar_parejas():
            await self._crear_pareja(user_a, user_b, by_affinity)

    def _compatibles(self, uid_a: str, uid_b: str) -> bool:
        """
        False si alguno bloqueo al otro. El bloqueo es reciproco: basta con
        que una de las dos personas lo haya pedido para que no se crucen.
        """
        a = self._waiting.get(uid_a)
        b = self._waiting.get(uid_b)
        if a is None or b is None:
            return False
        return uid_b not in a.blocked and uid_a not in b.blocked

    def _emparejar_lista(
        self,
        uids: list[str],
        por_afinidad: bool,
        parejas: list[tuple[str, str, bool]],
        tomados: set[str],
    ) -> None:
        """
        Forma parejas dentro de una lista respetando los bloqueos.

        Si el primero de la fila no es compatible con el segundo, se busca al
        siguiente candidato en vez de descartar a nadie de la ronda.
        """
        pendientes = [u for u in uids if u not in tomados]
        while len(pendientes) >= 2:
            a = pendientes.pop(0)
            companero = next(
                (u for u in pendientes if self._compatibles(a, u)),
                None,
            )
            if companero is None:
                continue  # a espera a la proxima ronda
            pendientes.remove(companero)
            parejas.append((a, companero, por_afinidad))
            tomados.update((a, companero))

    def _buscar_parejas(self) -> list[tuple[str, str, bool]]:
        """
        Decide que pares se forman. No hace await para que la seleccion sea
        atomica dentro del bucle de eventos y nadie quede emparejado dos veces.
        """
        parejas: list[tuple[str, str, bool]] = []
        tomados: set[str] = set()

        # --- Ronda 1: misma categoria ------------------------------------
        por_categoria: dict[str, list[str]] = {}
        for uid, entry in self._waiting.items():
            por_categoria.setdefault(entry.topic, []).append(uid)

        for uids in por_categoria.values():
            # el que mas ha esperado se empareja primero
            uids.sort(key=lambda u: self._waiting[u].joined_at)
            self._emparejar_lista(uids, True, parejas, tomados)

        # --- Ronda 2: cualquiera, solo para quienes ya esperaron -----------
        pacientes = [
            uid for uid, entry in self._waiting.items()
            if uid not in tomados and entry.acepta_cualquiera
        ]
        pacientes.sort(key=lambda u: self._waiting[u].joined_at)
        self._emparejar_lista(pacientes, False, parejas, tomados)

        return parejas

    async def _crear_pareja(self, user_a_id: str, user_b_id: str, by_affinity: bool) -> None:
        """Saca a ambos de la cola, les avisa y publica el evento de match creado."""
        entry_a = self._waiting.pop(user_a_id, None)
        entry_b = self._waiting.pop(user_b_id, None)

        if entry_a is None or entry_b is None:
            # Alguno se fue mientras tanto: devolvemos al que quede
            if entry_a is not None:
                self._waiting[user_a_id] = entry_a
            if entry_b is not None:
                self._waiting[user_b_id] = entry_b
            return

        session_id = str(uuid.uuid4())
        # Si comparten categoria se usa esa; si no, la del que lleva mas tiempo esperando
        topic = entry_a.topic if by_affinity else entry_a.topic

        entry_a.result = MatchResult(
            match_id="", partner_id=user_b_id, partner_username=entry_b.username,
            session_id=session_id, my_task=entry_a.task_info,
            partner_task=entry_b.task_info, topic=topic, by_affinity=by_affinity,
        )
        entry_b.result = MatchResult(
            match_id="", partner_id=user_a_id, partner_username=entry_a.username,
            session_id=session_id, my_task=entry_b.task_info,
            partner_task=entry_a.task_info, topic=topic, by_affinity=by_affinity,
        )

        await self._notificar(entry_a, user_b_id, entry_b, session_id, topic, by_affinity)
        await self._notificar(entry_b, user_a_id, entry_a, session_id, topic, by_affinity)

        # Limpieza de Redis
        await redis_client.lrem(QUEUE_KEY, 0, user_a_id)
        await redis_client.lrem(QUEUE_KEY, 0, user_b_id)
        await redis_client.lrem(QUEUE_KEY_TOPIC.format(topic=entry_a.topic), 0, user_a_id)
        await redis_client.lrem(QUEUE_KEY_TOPIC.format(topic=entry_b.topic), 0, user_b_id)

        await EventBus.publish("match.created", {
            "session_id":  session_id,
            "user_a_id":   user_a_id,
            "user_b_id":   user_b_id,
            "task_info_a": entry_a.task_info,
            "task_info_b": entry_b.task_info,
            "topic":       topic,
            "by_affinity": by_affinity,
        })

        entry_a.event.set()
        entry_b.event.set()

        logger.info(
            "Matchmaking: pareja %s <-> %s en '%s' (%s) sesion %s",
            user_a_id, user_b_id, topic,
            "por afinidad" if by_affinity else "cola general", session_id,
        )

    async def _notificar(
        self,
        entry:      _WaitEntry,
        partner_id: str,
        partner:    _WaitEntry,
        session_id: str,
        topic:      str,
        by_affinity: bool,
    ) -> None:
        """Avisa a un usuario que ya tiene companero. Un fallo aqui no rompe el match."""
        try:
            await entry.websocket.send_json({
                "type": "MATCHED",
                "payload": {
                    "session_id":       session_id,
                    "partner_id":       partner_id,
                    "partner_username": partner.username,
                    "my_task":          entry.task_info,
                    "partner_task":     partner.task_info,
                    "topic":            topic,
                    "partner_topic":    partner.topic,
                    "by_affinity":      by_affinity,
                },
            })
        except Exception as e:
            logger.warning("No se pudo avisar del match a %s: %s", partner_id, e)

    # ------------------------------------------------------------------
    # Revision periodica
    # ------------------------------------------------------------------

    def _ensure_sweeper(self) -> None:
        """
        Arranca la revision en segundo plano si no esta corriendo.

        Hace falta porque el paso a la cola general depende del tiempo esperado,
        no de que llegue alguien nuevo. Sin esta revision, dos personas de
        categorias distintas podrian quedarse esperando para siempre.
        """
        if self._sweeper is None or self._sweeper.done():
            self._sweeper = asyncio.create_task(self._sweep_loop())

    async def _sweep_loop(self) -> None:
        try:
            while self._waiting:
                await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
                if self._waiting:
                    await self._try_match_all()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Fallo la revision periodica de la cola de matchmaking")

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    def queue_size(self) -> int:
        return len(self._waiting)

    def queue_by_topic(self) -> dict[str, int]:
        """Cuantas personas esperan en cada categoria. Se usa en el dashboard."""
        conteo: dict[str, int] = {}
        for entry in self._waiting.values():
            conteo[entry.topic] = conteo.get(entry.topic, 0) + 1
        return conteo


matchmaking_service = MatchmakingService()
