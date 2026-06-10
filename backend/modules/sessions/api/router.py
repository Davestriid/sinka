"""
Router de sesiones.

Endpoints:
  WS  /api/sessions/{session_id}   — Canal en tiempo real (Pomodoro + Jardin)
  GET /api/sessions/active         — Sesion activa del usuario autenticado
  GET /api/sessions/{session_id}   — Estado de la sesion (HTTP)
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.cache import redis_client
from core.database import get_db
from core.ws_auth import get_current_user_ws
from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse
from modules.matchmaking.repositories.match_repository import MatchRepository
from modules.sessions.repositories.focus_session_repository import FocusSessionRepository
from modules.sessions.schemas.sessions import FocusSessionResponse
from modules.sessions.services.session_service import session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.websocket("/{session_id}")
async def session_websocket(
    session_id:   str,
    websocket:    WebSocket,
    current_user: UserResponse = Depends(get_current_user_ws),
    db:           AsyncSession = Depends(get_db),
) -> None:
    """
    Canal WebSocket de la sesion de enfoque.

    Mensajes servidor -> cliente:
      SESSION_STATE        Estado inicial de la sesion (Redis)
      SESSION_STARTED      Ambos conectados; incluye estado timer + planta
      TIMER_TICK           Cada segundo: fase, remaining, round
      PLANT_UPDATE         Cada 5 s: hp, stage, emoji, both_focused
      SESSION_ENDED        Razon: plant_died | timer_completed | user_left
      PARTNER_CONNECTED    La pareja se conecto
      PARTNER_DISCONNECTED La pareja se desconecto
      PARTNER_MESSAGE      Mensaje relay de la pareja

    Mensajes cliente -> servidor:
      {"type": "FOCUS_STATUS_UPDATE", "payload": {"is_active": bool}}
      Cualquier otro JSON: relay a la pareja
    """
    await websocket.accept()

    # Crear registros en DB si es la primera conexion
    session_repo = FocusSessionRepository(db)
    match_repo   = MatchRepository(db)
    focus_session = await session_repo.get_by_id(session_id)

    if focus_session is None:
        raw = await redis_client.get(f"session:{session_id}:state")
        if raw is None:
            await websocket.send_json({
                "type":   "ERROR",
                "detail": "Sesion no encontrada o expirada.",
            })
            await websocket.close(code=4004)
            return

        state = json.loads(raw)
        match = await match_repo.create(
            user_a_id=state["user_a_id"],
            user_b_id=state["user_b_id"],
        )
        focus_session = await session_repo.create(
            session_id=session_id,
            match_id=match.id,
            user_a_id=state["user_a_id"],
            user_b_id=state["user_b_id"],
        )
        logger.info(
            "Sessions: registro DB creado sesion %s (match %s)",
            session_id, match.id,
        )

    if current_user.id not in (focus_session.user_a_id, focus_session.user_b_id):
        await websocket.send_json({
            "type":   "ERROR",
            "detail": "No tienes acceso a esta sesion.",
        })
        await websocket.close(code=4003)
        return

    connected = await session_service.connect(session_id, current_user.id, websocket)
    if not connected:
        await websocket.send_json({"type": "ERROR", "detail": "Error al conectar."})
        await websocket.close(code=4000)
        return

    try:
        while True:
            data = await websocket.receive_json()

            # Sprint 3: manejar actualizacion de enfoque del cliente
            if isinstance(data, dict) and data.get("type") == "FOCUS_STATUS_UPDATE":
                payload   = data.get("payload", {})
                is_active = bool(payload.get("is_active", True))
                session_service.update_focus(session_id, current_user.id, is_active)
                continue  # no reenviar a la pareja

            # Relay generico (chat u otros mensajes)
            await session_service.relay_message(session_id, current_user.id, data)

    except WebSocketDisconnect:
        logger.info("Sessions WS: %s desconectado de sesion %s", current_user.id, session_id)
    except Exception as e:
        logger.error(
            "Sessions WS: error sesion %s usuario %s: %s",
            session_id, current_user.id, e,
        )
    finally:
        await session_service.disconnect(session_id, current_user.id)


@router.get("/active", response_model=FocusSessionResponse | None)
async def get_active_session(
    current_user: UserResponse = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
) -> FocusSessionResponse | None:
    repo    = FocusSessionRepository(db)
    session = await repo.get_active_by_user(current_user.id)
    return FocusSessionResponse.model_validate(session) if session else None


@router.get("/{session_id}", response_model=FocusSessionResponse)
async def get_session(
    session_id:   str,
    current_user: UserResponse = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
) -> FocusSessionResponse:
    repo    = FocusSessionRepository(db)
    session = await repo.get_by_id(session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesion no encontrada.")
    if current_user.id not in (session.user_a_id, session.user_b_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso.")
    return FocusSessionResponse.model_validate(session)
