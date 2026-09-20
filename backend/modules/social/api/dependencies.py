from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.identity.repositories.user_repository import UserRepository
from modules.social.repositories.social_repository import (
    FriendshipRepository,
    GardenRepository,
    QuotaRepository,
)
from modules.social.services.social_service import SocialService


def get_social_service(db: AsyncSession = Depends(get_db)) -> SocialService:
    return SocialService(
        friend_repo=FriendshipRepository(db),
        quota_repo=QuotaRepository(db),
        garden_repo=GardenRepository(db),
        user_repo=UserRepository(db),
    )
