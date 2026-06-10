from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.identity.repositories.user_repository import SessionRepository, UserRepository
from modules.identity.schemas.auth import UserResponse
from modules.identity.services.identity_service import IdentityService

bearer_scheme = HTTPBearer()


def get_identity_service(db: AsyncSession = Depends(get_db)) -> IdentityService:
    return IdentityService(
        user_repo=UserRepository(db),
        session_repo=SessionRepository(db),
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    service: IdentityService = Depends(get_identity_service),
) -> UserResponse:
    return await service.get_current_user(credentials.credentials)
