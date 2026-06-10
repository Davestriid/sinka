from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.gamification.models import UserStats


class GamificationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_user_id(self, user_id: str) -> UserStats | None:
        result = await self.db.execute(
            select(UserStats).where(UserStats.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, user_id: str) -> UserStats:
        stats = await self.get_by_user_id(user_id)
        if stats is None:
            stats = UserStats(user_id=user_id)
            self.db.add(stats)
            await self.db.flush()   # obtener el id sin commit
        return stats

    async def save(self, stats: UserStats) -> UserStats:
        await self.db.commit()
        await self.db.refresh(stats)
        return stats

    async def get_leaderboard(self, limit: int = 10) -> list[UserStats]:
        result = await self.db.execute(
            select(UserStats)
            .order_by(UserStats.xp_total.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
