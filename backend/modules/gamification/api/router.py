"""
Router de gamificación.

GET /api/gamification/stats        — mis estadísticas (XP, nivel, racha)
GET /api/gamification/leaderboard  — top 10 por XP total
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.gamification.repositories.gamification_repository import GamificationRepository
from modules.gamification.schemas.gamification import LeaderboardEntry, UserStatsResponse
from modules.gamification.services.gamification_service import (
    compute_xp_progress,
    gamification_service,
)
from modules.identity.api.dependencies import get_current_user
from modules.identity.repositories.user_repository import UserRepository
from modules.identity.schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/stats", response_model=UserStatsResponse)
async def get_my_stats(
    current_user: UserResponse = Depends(get_current_user),
) -> UserStatsResponse:
    """Devuelve las estadísticas de gamificación del usuario autenticado."""
    data = await gamification_service.get_stats(current_user.id, current_user.username)
    return UserStatsResponse(**data)


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntry]:
    """Top 10 usuarios por XP total acumulado."""
    repo    = GamificationRepository(db)
    entries = await repo.get_leaderboard(limit=10)

    # Necesitamos los usernames; hacemos un join manual via UserRepository
    user_repo = UserRepository(db)
    result    = []
    for rank, stat in enumerate(entries, start=1):
        user = await user_repo.get_by_id(stat.user_id)
        username = user.username if user else "–"
        xp_cl, xp_nl, pct = compute_xp_progress(stat.xp_total, stat.level)
        result.append(LeaderboardEntry(
            rank           = rank,
            user_id        = stat.user_id,
            username       = username,
            xp_total       = stat.xp_total,
            level          = stat.level,
            streak_current = stat.streak_current,
        ))
    return result
