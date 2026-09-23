"""
SessionService: gestiona el ciclo de vida de las sesiones de enfoque.

Sprint 3:
  - Game-loop asyncio por sesion (1 tick/s)
  - PomodoroTimer (25 min enfoque / 5 min descanso)
  - GardenService (HP, etapas, gain/decay segun actividad)
  - update_focus() para recibir estado de actividad del cliente
  - Broadcast TIMER_TICK cada segundo, PLANT_UPDATE cada 5 s
"""
import asyncio
import json
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from core.cache import redis_client
from core.event_bus import EventBus
from modules.sessions.services.extension_service import (
    MINUTOS_EXTENSION,
    extension_service,
    se_puede_ofrecer,
)
from modules.sessions.services.garden_service import GardenService, garden_service
from modules.sessions.services.pomodoro_service import PomodoroTimer

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)

SESSION_STATE_TTL = 60 * 35  # 35 minutos

# Cuanto se espera a que ambos voten la propuesta de continuar. Pasado ese
# tiempo la sesion cierra con normalidad: quedarse esperando indefinidamente
# dejaria la pantalla colgada si alguien ya se levanto del escritorio.
EXTENSION_VOTE_TIMEOUT = 60


@dataclass
class _SessionConnection:
    """Conexiones WS activas y estado en memoria para una sesion."""
    user_a_id: str
    user_b_id: str
    ws_a: "WebSocket | None" = None
    ws_b: "WebSocket | None" = None


class SessionService:
    """Singleton de proceso.  Gestiona WS, Pomodoro y Jardin por sesion."""

    def __init__(self) -> None:
        self._sessions:      dict[str, _SessionConnection] = {}
        # Focus scores: session_id -> {user_id: bool}  (True = activo)
        self._focus:         dict[str, dict[str, bool]]   = {}
        # Game-loops: session_id -> asyncio.Task
        self._loops:         dict[str, asyncio.Task]       = {}
        # Estado Pomodoro: session_id -> PomodoroTimer
        self._timers:        dict[str, PomodoroTimer]      = {}
        # Estado Jardin: session_id -> dict
        self._gardens:       dict[str, dict]               = {}
        # Cuantas veces se ha emparejado esta pareja, incluida la sesion actual
        self._encuentros:    dict[str, int]                = {}
        # Sincronizacion de la votacion para continuar
        self._voto_listo:    dict[str, asyncio.Event]      = {}
        self._voto_resultado: dict[str, str]               = {}

    # ── EventBus handler ────────────────────────────────────────────────────

    async def on_match_created(self, payload: dict[str, Any]) -> None:
        """Crea estado inicial en Redis al recibir match.created."""
        session_id = payload["session_id"]
        user_a_id  = payload["user_a_id"]
        user_b_id  = payload["user_b_id"]

        self._sessions[session_id] = _SessionConnection(
            user_a_id=user_a_id,
            user_b_id=user_b_id,
        )
        self._focus[session_id] = {user_a_id: True, user_b_id: True}

        state = {
            "session_id":     session_id,
            "user_a_id":      user_a_id,
            "user_b_id":      user_b_id,
            "status":         "waiting_connections",
            "connected_users": [],
            "task_info_a":    payload.get("task_info_a", {}),
            "task_info_b":    payload.get("task_info_b", {}),
            "topic":          payload.get("topic"),
            "by_affinity":    payload.get("by_affinity", False),
        }
        await redis_client.setex(
            f"session:{session_id}:state",
            SESSION_STATE_TTL,
            json.dumps(state),
        )
        logger.info("SessionService: sesion %s inicializada", session_id)

    # ── Gestion de conexiones WS ────────────────────────────────────────────

    async def connect(
        self,
        session_id: str,
        user_id:    str,
        websocket:  "WebSocket",
    ) -> bool:
        conn = self._sessions.get(session_id)

        if conn is None:
            raw = await redis_client.get(f"session:{session_id}:state")
            if raw is None:
                return False
            state = json.loads(raw)
            conn  = _SessionConnection(
                user_a_id=state["user_a_id"],
                user_b_id=state["user_b_id"],
            )
            self._sessions[session_id] = conn
            self._focus[session_id]    = {
                state["user_a_id"]: True,
                state["user_b_id"]: True,
            }

        if user_id not in (conn.user_a_id, conn.user_b_id):
            return False

        if user_id == conn.user_a_id:
            conn.ws_a = websocket
        else:
            conn.ws_b = websocket

        logger.info("SessionService: %s conecto a sesion %s", user_id, session_id)

        # Avisar a la pareja que esta persona acaba de entrar
        await self._notify_partner(session_id, user_id, {
            "type":    "PARTNER_CONNECTED",
            "payload": {"partner_id": user_id},
        })

        # Y avisar a quien acaba de entrar si la pareja ya estaba dentro.
        # Sin esto, el segundo en conectarse nunca se entera de que el primero
        # esta presente: se queda en "esperando pareja" y no arranca la camara.
        pareja_id = conn.user_b_id if user_id == conn.user_a_id else conn.user_a_id
        pareja_ws = conn.ws_b if user_id == conn.user_a_id else conn.ws_a
        if pareja_ws is not None:
            await websocket.send_json({
                "type":    "PARTNER_CONNECTED",
                "payload": {"partner_id": pareja_id},
            })

        # Enviar estado Redis
        raw = await redis_client.get(f"session:{session_id}:state")
        if raw:
            await websocket.send_json({
                "type":    "SESSION_STATE",
                "payload": json.loads(raw),
            })

        # Si ambos conectados, iniciar game-loop
        if conn.ws_a and conn.ws_b and session_id not in self._loops:
            self._timers[session_id]  = PomodoroTimer()
            self._gardens[session_id] = garden_service.initial_plant()
            task = asyncio.create_task(self._run_loop(session_id))
            self._loops[session_id]   = task
            logger.info("SessionService: game-loop iniciado para sesion %s", session_id)

            # Notificar SESSION_STARTED con estado inicial
            plant = self._gardens[session_id]
            timer = self._timers[session_id].snapshot()
            await self._broadcast(session_id, {
                "type":    "SESSION_STARTED",
                "payload": {"timer": timer, "plant": plant},
            })

        return True

    async def disconnect(self, session_id: str, user_id: str) -> None:
        conn = self._sessions.get(session_id)
        if conn is None:
            return

        if user_id == conn.user_a_id:
            conn.ws_a = None
        elif user_id == conn.user_b_id:
            conn.ws_b = None

        await self._notify_partner(session_id, user_id, {
            "type":    "PARTNER_DISCONNECTED",
            "payload": {"partner_id": user_id},
        })
        logger.info("SessionService: %s desconecto de sesion %s", user_id, session_id)

        partner_sigue = conn.ws_a is not None or conn.ws_b is not None
        sesion_en_curso = session_id in self._loops

        if partner_sigue and sesion_en_curso:
            # Alguien se fue a media sesion. No tiene sentido dejar al otro
            # esperando indefinidamente con "esperando pareja": se cierra la
            # sesion ya mismo para los dos, y quien abandono pierde puntaje
            # de confianza (ver GamificationService._penalizar_abandono).
            await self._end_session_por_abandono(session_id, conn, user_id)
        elif conn.ws_a is None and conn.ws_b is None:
            # Ninguno sigue conectado: no queda a quien avisar, solo limpiar.
            self._cancel_loop(session_id)

    async def _end_session_por_abandono(
        self,
        session_id: str,
        conn: "_SessionConnection",
        quien_salio: str,
    ) -> None:
        """Cierra la sesion de inmediato porque alguien se fue a medio camino."""
        timer = self._timers.get(session_id)
        plant = self._gardens.get(session_id, {})
        timer_state = timer.snapshot() if timer else {}
        rounds = timer_state.get("round", 1)

        # Aproximacion de cuantos minutos alcanzaron a trabajar juntos, solo
        # para pesar la penalizacion (irse muy al principio pesa mas).
        minutos = 0
        if timer:
            minutos = max(0, (timer.round - 1) * 30 + timer.elapsed // 60)

        self._cancel_loop(session_id)

        await self._broadcast(session_id, {
            "type":    "SESSION_ENDED",
            "payload": {"reason": "user_left", "left_by": quien_salio, "plant": plant},
        })

        await EventBus.publish("session.completed", {
            "session_id":       session_id,
            "user_a_id":        conn.user_a_id,
            "user_b_id":        conn.user_b_id,
            "rounds_completed": rounds,
            "reason":           "user_left",
            "left_by":          quien_salio,
            "penalty_severity": "normal",
            "minutes_elapsed":  minutos,
            "plant_stage":      plant.get("stage", ""),
        })
        logger.info(
            "SessionService: sesion %s cerrada porque %s abandono", session_id, quien_salio
        )

        self._timers.pop(session_id, None)
        self._gardens.pop(session_id, None)
        self._encuentros.pop(session_id, None)
        self._voto_listo.pop(session_id, None)
        self._voto_resultado.pop(session_id, None)
        extension_service.limpiar(session_id)

    def update_focus(self, session_id: str, user_id: str, is_active: bool) -> None:
        """Actualiza el estado de actividad de un usuario (sin IO)."""
        scores = self._focus.get(session_id)
        if scores is not None and user_id in scores:
            scores[user_id] = is_active

    async def relay_message(
        self,
        session_id: str,
        sender_id:  str,
        message:    dict[str, Any],
    ) -> None:
        await self._notify_partner(session_id, sender_id, {
            "type":    "PARTNER_MESSAGE",
            "payload": {"from": sender_id, "data": message},
        })

    def session_exists(self, session_id: str) -> bool:
        return session_id in self._sessions

    # ── Extension acordada ──────────────────────────────────────────────────

    def set_encounter_count(self, session_id: str, veces: int) -> None:
        """
        Guarda cuantas veces se ha emparejado esta pareja, contando la sesion
        actual. El router lo consulta en la base de datos al conectar, porque
        el game-loop no tiene sesion de base de datos propia.
        """
        self._encuentros[session_id] = veces

    async def register_extension_vote(
        self,
        session_id: str,
        user_id:    str,
        acepta:     bool,
    ) -> None:
        """Recibe el voto de una persona y avisa a ambas como va la cosa."""
        conn = self._sessions.get(session_id)
        if conn is None:
            return

        participantes = [conn.user_a_id, conn.user_b_id]
        estado = extension_service.votar(session_id, user_id, acepta, participantes)

        await self._broadcast(session_id, {
            "type":    "EXTENSION_VOTE_UPDATE",
            "payload": estado,
        })

        if estado["result"] != "esperando":
            self._voto_resultado[session_id] = estado["result"]
            evento = self._voto_listo.get(session_id)
            if evento is not None:
                evento.set()

    async def _ofrecer_extension(self, session_id: str, timer: PomodoroTimer) -> bool:
        """
        Propone continuar y espera la respuesta de ambos.

        Devuelve True si la sesion sigue. La propuesta solo aparece a partir del
        segundo encuentro con la misma persona: extender es un gesto de confianza
        y no tiene sentido plantearselo a alguien que se acaba de conocer.
        """
        encuentros = self._encuentros.get(session_id, 0)
        if not se_puede_ofrecer(encuentros, timer.extensions):
            return False

        estado = extension_service.iniciar(session_id, timer.extensions)
        evento = asyncio.Event()
        self._voto_listo[session_id] = evento
        self._voto_resultado.pop(session_id, None)

        await self._broadcast(session_id, {
            "type": "EXTENSION_OFFER",
            "payload": {
                "minutes":         MINUTOS_EXTENSION,
                "seconds_to_vote": EXTENSION_VOTE_TIMEOUT,
                "extensions_used": estado.extensiones_usadas,
            },
        })
        logger.info("Extension: propuesta enviada en la sesion %s", session_id)

        try:
            await asyncio.wait_for(evento.wait(), timeout=EXTENSION_VOTE_TIMEOUT)
            aceptada = self._voto_resultado.get(session_id) == "aceptada"
        except asyncio.TimeoutError:
            aceptada = False
            await self._broadcast(session_id, {
                "type":    "EXTENSION_RESULT",
                "payload": {"result": "expirada"},
            })
            logger.info("Extension: nadie respondio a tiempo en la sesion %s", session_id)
        finally:
            self._voto_listo.pop(session_id, None)
            self._voto_resultado.pop(session_id, None)

        if not aceptada:
            extension_service.limpiar(session_id)
            return False

        estado_timer = timer.extend()
        await self._broadcast(session_id, {
            "type": "EXTENSION_RESULT",
            "payload": {
                "result":  "aceptada",
                "minutes": MINUTOS_EXTENSION,
                "timer":   estado_timer,
            },
        })
        logger.info("Extension: la sesion %s continua un bloque mas", session_id)
        return True

    # ── Game-loop ───────────────────────────────────────────────────────────

    async def _run_loop(self, session_id: str) -> None:
        """
        Corre cada segundo mientras la sesion este activa.
        Emite TIMER_TICK cada segundo y PLANT_UPDATE cada 5 segundos.
        """
        tick = 0
        try:
            while True:
                await asyncio.sleep(1)
                tick += 1

                conn  = self._sessions.get(session_id)
                timer = self._timers.get(session_id)
                plant = self._gardens.get(session_id)
                if conn is None or timer is None or plant is None:
                    break

                # --- Avanzar timer ---
                timer_state = timer.tick()

                # --- Avanzar jardin (usa actividad actual de cada usuario) ---
                focus  = self._focus.get(session_id, {})
                a_active = focus.get(conn.user_a_id, True)
                b_active = focus.get(conn.user_b_id, True)
                plant  = garden_service.tick(plant, a_active, b_active)
                self._gardens[session_id] = plant

                # --- Broadcast TIMER_TICK cada segundo ---
                await self._broadcast(session_id, {
                    "type":    "TIMER_TICK",
                    "payload": timer_state,
                })

                # --- Broadcast PLANT_UPDATE cada 5 s ---
                if tick % 5 == 0:
                    await self._broadcast(session_id, {
                        "type":    "PLANT_UPDATE",
                        "payload": plant,
                    })

                # --- Persistir en Redis cada 10 s ---
                if tick % 10 == 0:
                    await self._persist_state(session_id, plant, timer_state)

                # La planta ya no corta la sesion si el HP llega a cero. Antes
                # una pareja con algo de inactividad perdia toda la sesion de
                # golpe, lo cual era demasiado castigo: ahora el HP bajo solo
                # se refleja en menos XP y FocusCoins al terminar (mas abajo,
                # via plant_stage), pero el Pomodoro siempre se puede
                # completar entero.

                # --- Verificar si se completaron todos los rounds ---
                if timer_state.get("all_completed"):
                    # Antes de cerrar se ofrece continuar. Si ambos aceptan, el
                    # temporizador suma otra ronda y el bucle sigue sin cortar
                    # el jardin ni el estado acumulado.
                    if await self._ofrecer_extension(session_id, timer):
                        continue

                    await self._broadcast(session_id, {
                        "type":    "SESSION_ENDED",
                        "payload": {"reason": "timer_completed", "plant": plant},
                    })
                    await self._publish_session_completed(
                        session_id, conn, timer_state, "timer_completed", plant
                    )
                    break

        except asyncio.CancelledError:
            logger.info("SessionService: game-loop cancelado para sesion %s", session_id)
        except Exception as e:
            logger.error("SessionService: error en game-loop sesion %s: %s", session_id, e)
        finally:
            self._loops.pop(session_id,   None)
            self._timers.pop(session_id,  None)
            self._gardens.pop(session_id, None)
            self._encuentros.pop(session_id, None)
            self._voto_listo.pop(session_id, None)
            self._voto_resultado.pop(session_id, None)
            extension_service.limpiar(session_id)

    def _cancel_loop(self, session_id: str) -> None:
        task = self._loops.pop(session_id, None)
        if task and not task.done():
            task.cancel()

    # ── Internos ────────────────────────────────────────────────────────────

    async def _broadcast(
        self,
        session_id: str,
        message:    dict[str, Any],
    ) -> None:
        """Envia un mensaje a ambos usuarios conectados de la sesion."""
        conn = self._sessions.get(session_id)
        if conn is None:
            return
        for ws in (conn.ws_a, conn.ws_b):
            if ws:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.warning(
                        "SessionService: no se pudo enviar broadcast sesion %s: %s",
                        session_id, e,
                    )

    async def _notify_partner(
        self,
        session_id: str,
        sender_id:  str,
        message:    dict[str, Any],
    ) -> None:
        conn = self._sessions.get(session_id)
        if conn is None:
            return
        partner_ws = (
            conn.ws_b if sender_id == conn.user_a_id
            else conn.ws_a if sender_id == conn.user_b_id
            else None
        )
        if partner_ws:
            try:
                await partner_ws.send_json(message)
            except Exception as e:
                logger.warning(
                    "SessionService: no se pudo notificar pareja sesion %s: %s",
                    session_id, e,
                )

    async def _publish_session_completed(
        self,
        session_id: str,
        conn: "_SessionConnection",
        timer_state: dict,
        reason: str,
        plant: dict,
    ) -> None:
        """Publica session.completed en el EventBus para que gamification actualice XP y FC."""
        rounds = timer_state.get("round", 1)
        if reason == "timer_completed":
            rounds = timer_state.get("max_rounds", rounds)
        await EventBus.publish("session.completed", {
            "session_id":       session_id,
            "user_a_id":        conn.user_a_id,
            "user_b_id":        conn.user_b_id,
            "rounds_completed": rounds,
            "reason":           reason,
            "plant_stage":      plant.get("stage", ""),
        })

    async def _persist_state(
        self,
        session_id:  str,
        plant:       dict,
        timer_state: dict,
    ) -> None:
        raw = await redis_client.get(f"session:{session_id}:state")
        state = json.loads(raw) if raw else {}
        state.update({
            "plant":  plant,
            "timer":  timer_state,
            "status": "active",
        })
        await redis_client.setex(
            f"session:{session_id}:state",
            SESSION_STATE_TTL,
            json.dumps(state),
        )


# Singleton compartido por todo el proceso
session_service = SessionService()
