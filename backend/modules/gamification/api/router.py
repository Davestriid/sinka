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


@router.get("/trust")
async def my_trust(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Puntaje de confianza del usuario con su historial de penalizaciones.

    Se expone para que quien tenga el puntaje bajo entienda por que, en vez
    de encontrarse con esperas mas largas sin explicacion.
    """
    from sqlalchemy import select

    from modules.gamification.models import SessionPenalty
    from modules.gamification.repositories.gamification_repository import (
        GamificationRepository,
    )
    from modules.gamification.services import trust_service

    stats = await GamificationRepository(db).get_or_create(current_user.id)

    result = await db.execute(
        select(SessionPenalty)
        .where(SessionPenalty.user_id == current_user.id)
        .order_by(SessionPenalty.created_at.desc())
        .limit(10)
    )
    historial = [
        {
            "reason":     p.reason,
            "points":     p.points,
            "severity":   p.severity,
            "created_at": p.created_at,
        }
        for p in result.scalars().all()
    ]

    return {
        **trust_service.estado(stats.trust_score),
        "sessions_abandoned": stats.sessions_abandoned,
        "recent_penalties":   historial,
    }


@router.get("/presence")
async def presence():
    """
    Cuanta gente esta concentrada ahora mismo.

    No requiere autenticacion: la pantalla de inicio lo muestra antes de que
    el visitante tenga cuenta, y ver actividad es justamente lo que invita a
    registrarse.
    """
    from modules.sessions.services.presence_service import presence_service

    return {
        "focusing_now": await presence_service.contar(),
        "by_topic":     await presence_service.contar_por_categoria(),
    }
