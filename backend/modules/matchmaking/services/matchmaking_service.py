"""
Motor de matchmaking.

Flujo:
1. Usuario conecta WS, envia TASK_INFO (area de trabajo, titulo, pomodoros objetivo)
2. join_queue() registra en Redis + dict en memoria + espera asyncio.Event
3. Cuando entra un segundo usuario, _try_match() los empareja atomicamente
4. Ambos reciben MATCHED con session_id, info del partner y su tarea
5. try/finally en el router garantiza limpieza de Redis aunque se desconecte
"""
import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from core.cache import redis_client
from core.event_bus import EventBus

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)

QUEUE_KEY = "matchmaking:global_queue"
QUEUE_TIMEOUT_SECONDS = 120  # 2 minutos maximos en cola


@dataclass
class MatchResult:
    match_id: str
    partner_id: str
    partner_username: str
    session_id: str
    my_task: dict       # task_info del propio usuario
    partner_task: dict  # task_info del partner


@dataclass
class _WaitEntry:
    websocket:  "WebSocket"
    username:   str
    task_info:  dict                  # {work_area, task_title, target_pomodoros}
    event:      asyncio.Event = field(default_factory=asyncio.Event)
    result:     MatchResult | None = None


class MatchmakingService:
    """Singleton por proceso. _waiting: usuarios actualmente en cola."""

    def __init__(self) -> None:
        self._waiting: dict[str, _WaitEntry] = {}

    async def join_queue(
        self,
        user_id:   str,
        username:  str,
        task_info: dict,
        websocket: "WebSocket",
    ) -> MatchResult | None:
        """
        Registra al usuario en la cola y espera hasta ser emparejado o timeout.
        Retorna MatchResult si se emparejo, None si expiro el tiempo.
        """
        if user_id in self._waiting:
            await websocket.send_json({
                "type":   "ERROR",
                "detail": "Ya estas en cola de emparejamiento.",
            })
            return None

        entry = _WaitEntry(
            websocket=websocket,
            username=username,
            task_info=task_info,
        )
        self._waiting[user_id] = entry

        await redis_client.rpush(QUEUE_KEY, user_id)
        queue_pos = await redis_client.llen(QUEUE_KEY)
        await websocket.send_json({
            "type":    "QUEUED",
            "payload": {"position": queue_pos},
        })
        logger.info("Matchmaking: %s entro a la cola (pos %d)", user_id, queue_pos)

        await self._try_match_all()

        try:
            await asyncio.wait_for(entry.event.wait(), timeout=QUEUE_TIMEOUT_SECONDS)
            return entry.result
        except asyncio.TimeoutError:
            logger.info("Matchmaking: timeout para usuario %s", user_id)
            return None

    async def leave_queue(self, user_id: str) -> None:
        """Elimina al usuario de la cola (llamado desde finally del router). Idempotente."""
        self._waiting.pop(user_id, None)
        removed = await redis_client.lrem(QUEUE_KEY, 0, user_id)
        if removed:
            logger.info("Matchmaking: %s removido de Redis", user_id)

    async def _try_match_all(self) -> None:
        """Empareja todos los pares disponibles. Atomico en asyncio (sin awaits entre pops)."""
        waiting_ids = list(self._waiting.keys())
        if len(waiting_ids) < 2:
            return

        user_a_id = waiting_ids[0]
        user_b_id = waiting_ids[1]

        entry_a = self._waiting.pop(user_a_id, None)
        entry_b = self._waiting.pop(user_b_id, None)

        if entry_a is None or entry_b is None:
            if entry_a:
                self._waiting[user_a_id] = entry_a
            if entry_b:
                self._waiting[user_b_id] = entry_b
            return

        session_id = str(uuid.uuid4())

        result_a = MatchResult(
            match_id="",
            partner_id=user_b_id,
            partner_username=entry_b.username,
            session_id=session_id,
            my_task=entry_a.task_info,
            partner_task=entry_b.task_info,
        )
        result_b = MatchResult(
            match_id="",
            partner_id=user_a_id,
            partner_username=entry_a.username,
            session_id=session_id,
            my_task=entry_b.task_info,
            partner_task=entry_a.task_info,
        )

        entry_a.result = result_a
        entry_b.result = result_b

        # Notificar a ambos via WS (incluye task_info de la pareja)
        try:
            await entry_a.websocket.send_json({
                "type": "MATCHED",
                "payload": {
                    "session_id":       session_id,
                    "partner_id":       user_b_id,
                    "partner_username": entry_b.username,
                    "my_task":          entry_a.task_info,
                    "partner_task":     entry_b.task_info,
                },
            })
        except Exception as e:
            logger.warning("No se pudo notificar a user_a %s: %s", user_a_id, e)

        try:
            await entry_b.websocket.send_json({
                "type": "MATCHED",
                "payload": {
                    "session_id":       session_id,
                    "partner_id":       user_a_id,
                    "partner_username": entry_a.username,
                    "my_task":          entry_b.task_info,
                    "partner_task":     entry_a.task_info,
                },
            })
        except Exception as e:
            logger.warning("No se pudo notificar a user_b %s: %s", user_b_id, e)

        await redis_client.lrem(QUEUE_KEY, 0, user_a_id)
        await redis_client.lrem(QUEUE_KEY, 0, user_b_id)

        # Publicar evento (incluye task_info para que sessions lo persista en Redis)
        await EventBus.publish("match.created", {
            "session_id":    session_id,
            "user_a_id":     user_a_id,
            "user_b_id":     user_b_id,
            "task_info_a":   entry_a.task_info,
            "task_info_b":   entry_b.task_info,
        })

        entry_a.event.set()
        entry_b.event.set()

        logger.info(
            "Matchmaking: pareja creada %s <-> %s (session %s)",
            user_a_id, user_b_id, session_id,
        )

    def queue_size(self) -> int:
        return len(self._waiting)


matchmaking_service = MatchmakingService()
