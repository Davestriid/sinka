"""
WebSocket authentication dependency.

Los WebSockets no pueden enviar cabeceras HTTP personalizadas en el handshake,
por eso el token JWT se pasa como query parameter: ?token=<access_token>
"""
from fastapi import Depends, Query, WebSocket, WebSocketException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.identity.repositories.user_repository import SessionRepository, UserRepository
from modules.identity.schemas.auth import UserResponse
from modules.identity.services.identity_service import IdentityService


def _get_identity_service(db: AsyncSession = Depends(get_db)) -> IdentityService:
    return IdentityService(
        user_repo=UserRepository(db),
        session_repo=SessionRepository(db),
    )


async def get_current_user_ws(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
    service: IdentityService = Depends(_get_identity_service),
) -> UserResponse:
    """
    Extrae y valida el JWT desde el query param ?token=...
    Lanza WebSocketException(4001) si el token es inválido.
    """
    try:
        return await service.get_current_user(token)
    except Exception:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Token invalido o expirado.",
        )
