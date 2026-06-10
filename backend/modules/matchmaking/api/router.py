"""
Router de matchmaking.

Flujo WebSocket:
  1. Cliente conecta con ?token=<jwt>
  2. Cliente envia primer mensaje: {"type": "TASK_INFO", "payload": {...}}
  3. Servidor entra a la cola y espera MATCHED o timeout
  4. try/finally garantiza limpieza de la cola aunque se desconecte antes
"""
import asyncio
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from core.ws_auth import get_current_user_ws
from modules.identity.schemas.auth import UserResponse
from modules.matchmaking.services.matchmaking_service import matchmaking_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/matchmaking", tags=["matchmaking"])

TASK_INFO_TIMEOUT = 30  # segundos para recibir TASK_INFO antes de rechazar

# Areas de trabajo validas
VALID_WORK_AREAS = {
    "coding", "design", "video", "writing",
    "data", "music", "study", "research", "marketing", "other",
}


def _validate_task_info(payload: dict) -> dict:
    """Valida y normaliza la informacion de tarea del usuario."""
    work_area = payload.get("work_area", "other")
    if work_area not in VALID_WORK_AREAS:
        work_area = "other"

    task_title = str(payload.get("task_title", "Sin titulo")).strip()[:80]
    if not task_title:
        task_title = "Sin titulo"

    target_pomodoros = int(payload.get("target_pomodoros", 1))
    target_pomodoros = max(1, min(8, target_pomodoros))  # 1-8 pomodoros

    return {
        "work_area":         work_area,
        "task_title":        task_title,
        "target_pomodoros":  target_pomodoros,
    }


@router.websocket("/queue")
async def join_matchmaking_queue(
    websocket:    WebSocket,
    current_user: UserResponse = Depends(get_current_user_ws),
) -> None:
    """
    WebSocket de cola de emparejamiento.

    Protocolo:
    Cliente → Servidor  {"type": "TASK_INFO", "payload": {work_area, task_title, target_pomodoros}}
    Servidor → Cliente  {"type": "QUEUED",   "payload": {"position": N}}
    Servidor → Cliente  {"type": "MATCHED",  "payload": {session_id, partner_id,
                                                          partner_username, my_task, partner_task}}
    Servidor → Cliente  {"type": "QUEUE_TIMEOUT", "message": "..."}
    Servidor → Cliente  {"type": "ERROR",    "detail": "..."}
    """
    await websocket.accept()
    logger.info("WS Matchmaking: %s conectado", current_user.id)

    # Paso 1: esperar informacion de tarea del cliente
    try:
        raw = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=TASK_INFO_TIMEOUT,
        )
    except asyncio.TimeoutError:
        await websocket.send_json({
            "type":   "ERROR",
            "detail": "Se agoto el tiempo esperando la informacion de tu tarea.",
        })
        return
    except WebSocketDisconnect:
        logger.info("WS Matchmaking: %s desconectado antes de enviar TASK_INFO", current_user.id)
        return

    if not isinstance(raw, dict) or raw.get("type") != "TASK_INFO":
        await websocket.send_json({
            "type":   "ERROR",
            "detail": "Primer mensaje debe ser de tipo TASK_INFO.",
        })
        return

    task_info = _validate_task_info(raw.get("payload", {}))
    logger.info(
        "WS Matchmaking: %s — area=%s tarea='%s' pomodoros=%d",
        current_user.id,
        task_info["work_area"],
        task_info["task_title"],
        task_info["target_pomodoros"],
    )

    # Paso 2: entrar a la cola de emparejamiento
    try:
        result = await matchmaking_service.join_queue(
            user_id=current_user.id,
            username=current_user.username,
            task_info=task_info,
            websocket=websocket,
        )

        if result is None:
            try:
                await websocket.send_json({
                    "type":    "QUEUE_TIMEOUT",
                    "message": "No se encontro pareja en el tiempo limite. Intentalo de nuevo.",
                })
            except Exception:
                pass

    except WebSocketDisconnect:
        logger.info("WS Matchmaking: %s desconectado mientras esperaba", current_user.id)
    except Exception as e:
        logger.error("WS Matchmaking: error inesperado %s: %s", current_user.id, e)
        try:
            await websocket.send_json({"type": "ERROR", "detail": "Error interno del servidor."})
        except Exception:
            pass
    finally:
        await matchmaking_service.leave_queue(current_user.id)
        logger.info("WS Matchmaking: %s removido de cola (finally)", current_user.id)


@router.get("/status", tags=["matchmaking"])
async def queue_status():
    """Numero de usuarios actualmente en cola de emparejamiento."""
    return {"users_waiting": matchmaking_service.queue_size()}
