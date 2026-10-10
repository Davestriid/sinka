"""
GroupSessionService: ciclo de vida de una sesion de enfoque grupal (2-8
personas), una vez que la sala de espera del grupo la arranca.

Es el equivalente, para grupos, de modules.sessions.services.session_service
— pero ese esta construido solo para parejas (ws_a/ws_b fijos). Las sesiones
de grupo necesitan una cantidad variable de participantes, asi que viven en
su propio servicio en vez de forzar el de parejas a soportar N personas.

Reglas de vida/muerte de la sala (a pedido explicito, distintas de las
parejas):
  - Mientras nadie este conectado, el temporizador se pausa solo (no sigue
    corriendo para una sala vacia).
  - Si la sala se vacia del todo, se mantiene viva por VACIADO_GRACE_SECONDS
    por si alguien vuelve a entrar. Pasado ese tiempo sin nadie, se cierra.
  - Nunca puede quedar una sola persona conectada: en el momento en que la
    cantidad de conectados baja a 1, la sesion termina ahi mismo para esa
    ultima persona. A diferencia de las parejas (que tienen un margen de
    reconexion de unos segundos por si fue solo una recarga de pagina), acá
    no tiene sentido ese margen porque el grupo sigue "vivo" con los demas
    yendose uno por uno — la unica razon valida para estar en la sala es
    estar acompañado.
"""
import asyncio
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from core.event_bus import EventBus
from modules.sessions.services.pomodoro_service import PomodoroTimer

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Cuanto se mantiene viva (temporizador pausado) una sala que se vacio del
# todo, por si alguien vuelve a entrar, antes de cerrarla de verdad.
VACIADO_GRACE_SECONDS = 10 * 60


@dataclass
class _GroupSession:
    group_id:        str
    session_id:      str
    owner_id:        str
    participant_ids: list[str]
    websockets:      dict[str, "WebSocket"] = field(default_factory=dict)
    timer:           PomodoroTimer          = field(default_factory=PomodoroTimer)


class GroupSessionService:
    """Singleton de proceso. Una sala por sesion de grupo, en memoria."""

    def __init__(self) -> None:
        self._sessions: dict[str, _GroupSession]      = {}
        self._loops:    dict[str, asyncio.Task]        = {}
        self._vaciado_pendiente: dict[str, asyncio.Task] = {}

    # ── Alta de la sala ──────────────────────────────────────────────────────

    def register(
        self,
        group_id: str,
        session_id: str,
        owner_id: str,
        participant_ids: list[str],
    ) -> None:
        """
        Crea el registro de la sesion apenas el lobby la arranca, antes de
        que nadie haya abierto el WebSocket todavia. Sin esto, el primer
        connect() no tendria forma de saber quienes son los participantes
        esperados ni a que grupo pertenece la sala.
        """
        self._sessions[session_id] = _GroupSession(
            group_id=group_id,
            session_id=session_id,
            owner_id=owner_id,
            participant_ids=list(participant_ids),
        )
        logger.info(
            "GroupSession: sala %s registrada para el grupo %s (%d participantes esperados)",
            session_id, group_id, len(participant_ids),
        )

    def session_exists(self, session_id: str) -> bool:
        return session_id in self._sessions

    # ── Conexion ─────────────────────────────────────────────────────────────

    async def connect(self, session_id: str, user_id: str, websocket: "WebSocket") -> bool:
        sesion = self._sessions.get(session_id)
        if sesion is None or user_id not in sesion.participant_ids:
            return False

        sesion.websockets[user_id] = websocket

        # Si la sala se habia vaciado y estaba contando para cerrarse, esta
        # reconexion la salva.
        tarea = self._vaciado_pendiente.pop(session_id, None)
        if tarea and not tarea.done():
            tarea.cancel()

        # Avisar a los demas que esta persona entro, para que cada quien
        # arme su propia conexion WebRTC con ella (malla, no estrella).
        await self._broadcast(session_id, {
            "type":    "PARTICIPANT_JOINED",
            "payload": {"user_id": user_id},
        }, excluir=user_id)

        # Y a quien entra, decirle quienes ya estaban — para que inicie la
        # conexion con cada uno de ellos.
        await websocket.send_json({
            "type": "ROOM_STATE",
            "payload": {
                "participants": [uid for uid in sesion.websockets if uid != user_id],
                "timer":        sesion.timer.snapshot(),
            },
        })

        if session_id not in self._loops:
            self._loops[session_id] = asyncio.create_task(self._run_loop(session_id))

        logger.info("GroupSession: %s conecto a la sala %s", user_id, session_id)
        return True

    async def disconnect(self, session_id: str, user_id: str) -> None:
        sesion = self._sessions.get(session_id)
        if sesion is None:
            return

        sesion.websockets.pop(user_id, None)

        await self._broadcast(session_id, {
            "type":    "PARTICIPANT_LEFT",
            "payload": {"user_id": user_id},
        })
        logger.info("GroupSession: %s salio de la sala %s", user_id, session_id)

        restantes = len(sesion.websockets)

        if restantes == 0:
            tarea_previa = self._vaciado_pendiente.pop(session_id, None)
            if tarea_previa and not tarea_previa.done():
                tarea_previa.cancel()
            self._vaciado_pendiente[session_id] = asyncio.create_task(
                self._cerrar_tras_vaciado(session_id)
            )
        elif restantes == 1:
            # No puede quedar una sola persona en la sala.
            await self._end_session(session_id, reason="sola")

    # ── Señalizacion WebRTC (malla) y chat ──────────────────────────────────

    async def relay_signal(
        self, session_id: str, sender_id: str, target_id: str, data: dict[str, Any],
    ) -> None:
        sesion = self._sessions.get(session_id)
        if sesion is None:
            return
        ws = sesion.websockets.get(target_id)
        if ws is None:
            return
        try:
            await ws.send_json({
                "type":    "SIGNAL",
                "payload": {"from": sender_id, "data": data},
            })
        except Exception as e:
            logger.warning("GroupSession: no se pudo reenviar señal en %s: %s", session_id, e)

    async def relay_chat(self, session_id: str, sender_id: str, texto: str) -> None:
        await self._broadcast(session_id, {
            "type":    "CHAT_MESSAGE",
            "payload": {"from": sender_id, "text": texto},
        }, excluir=sender_id)

    # ── Temporizador compartido ──────────────────────────────────────────────

    async def _run_loop(self, session_id: str) -> None:
        try:
            while True:
                await asyncio.sleep(1)
                sesion = self._sessions.get(session_id)
                if sesion is None:
                    break

                # Sala vacia: el tiempo no avanza, simplemente se espera.
                if not sesion.websockets:
                    continue

                estado = sesion.timer.tick()
                await self._broadcast(session_id, {"type": "TIMER_TICK", "payload": estado})

                if estado.get("all_completed"):
                    await self._end_session(session_id, reason="timer_completed")
                    break
        except asyncio.CancelledError:
            logger.info("GroupSession: loop cancelado para %s", session_id)
        except Exception:
            logger.exception("GroupSession: error en el loop de %s", session_id)
        finally:
            self._loops.pop(session_id, None)

    # ── Cierre ───────────────────────────────────────────────────────────────

    async def _end_session(self, session_id: str, reason: str) -> None:
        sesion = self._sessions.get(session_id)
        if sesion is None:
            return

        await self._broadcast(session_id, {
            "type":    "SESSION_ENDED",
            "payload": {"reason": reason},
        })

        if reason == "timer_completed":
            # Se premia a quien seguia conectado al terminar. Si alguien se
            # fue antes, ya no cuenta — igual que en el modo solitario, que
            # tampoco premia abandonos.
            participantes = list(sesion.websockets.keys()) or sesion.participant_ids
            await EventBus.publish("group_session.completed", {
                "session_id":       session_id,
                "group_id":         sesion.group_id,
                "participant_ids":  participantes,
                "rounds_completed": sesion.timer.round,
            })

        task = self._loops.pop(session_id, None)
        if task and not task.done():
            task.cancel()

        tarea_v = self._vaciado_pendiente.pop(session_id, None)
        if tarea_v and not tarea_v.done():
            tarea_v.cancel()

        self._sessions.pop(session_id, None)
        logger.info("GroupSession: sala %s cerrada (%s)", session_id, reason)

    async def _cerrar_tras_vaciado(self, session_id: str) -> None:
        try:
            await asyncio.sleep(VACIADO_GRACE_SECONDS)
        except asyncio.CancelledError:
            return  # alguien volvio a entrar — ver connect()

        self._vaciado_pendiente.pop(session_id, None)
        sesion = self._sessions.get(session_id)
        if sesion is None or sesion.websockets:
            return  # ya se cerro por otro lado, o alguien volvio sin cancelar a tiempo

        logger.info("GroupSession: sala %s expiro tras %d min vacia", session_id, VACIADO_GRACE_SECONDS // 60)
        await self._end_session(session_id, reason="vaciado")

    # ── Difusion ─────────────────────────────────────────────────────────────

    async def _broadcast(
        self, session_id: str, message: dict[str, Any], excluir: str | None = None,
    ) -> None:
        sesion = self._sessions.get(session_id)
        if sesion is None:
            return
        caidos: list[str] = []
        for uid, ws in list(sesion.websockets.items()):
            if uid == excluir:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                caidos.append(uid)
        for uid in caidos:
            sesion.websockets.pop(uid, None)


# Singleton compartido por todo el proceso
group_session_service = GroupSessionService()
