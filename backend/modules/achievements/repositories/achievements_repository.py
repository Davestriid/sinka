from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.achievements.models import AchievementCounter, UserAchievement
from modules.gamification.models import UserInventory, UserStats
from modules.social.models import ACCEPTED, Friendship, GardenPlant


class AchievementsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── desbloqueados ────────────────────────────────────────────────────
    async def get_unlocked_ids(self, user_id: str) -> set[str]:
        result = await self.db.execute(
            select(UserAchievement.achievement_id).where(UserAchievement.user_id == user_id)
        )
        return set(result.scalars().all())

    async def unlock(self, user_id: str, achievement_id: str) -> UserAchievement:
        registro = UserAchievement(user_id=user_id, achievement_id=achievement_id)
        self.db.add(registro)
        await self.db.flush()
        return registro

    # ── contador propio (sesiones de grupo) ─────────────────────────────
    async def get_or_create_counter(self, user_id: str) -> AchievementCounter:
        result = await self.db.execute(
            select(AchievementCounter).where(AchievementCounter.user_id == user_id)
        )
        contador = result.scalar_one_or_none()
        if contador is None:
            contador = AchievementCounter(user_id=user_id)
            self.db.add(contador)
            await self.db.flush()
        return contador

    async def increment_group_sessions(self, user_id: str) -> int:
        contador = await self.get_or_create_counter(user_id)
        contador.group_sessions_started += 1
        await self.db.flush()
        return contador.group_sessions_started

    # ── metricas leidas de otros modulos ────────────────────────────────
    # No se duplican: se leen directo de la tabla que ya las lleva.

    async def get_user_stats(self, user_id: str) -> UserStats | None:
        result = await self.db.execute(
            select(UserStats).where(UserStats.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def count_friends(self, user_id: str) -> int:
        result = await self.db.execute(
            select(func.count(Friendship.id)).where(
                Friendship.status == ACCEPTED,
                or_(Friendship.user_low_id == user_id, Friendship.user_high_id == user_id),
            )
        )
        return result.scalar_one() or 0

    async def count_shop_purchases(self, user_id: str) -> int:
        result = await self.db.execute(
            select(func.count(UserInventory.id)).where(UserInventory.user_id == user_id)
        )
        return result.scalar_one() or 0

    async def count_maxed_plants(self, user_id: str, max_phase: int) -> int:
        result = await self.db.execute(
            select(func.count(GardenPlant.id))
            .join(Friendship, Friendship.id == GardenPlant.friendship_id)
            .where(
                GardenPlant.phase >= max_phase,
                or_(Friendship.user_low_id == user_id, Friendship.user_high_id == user_id),
            )
        )
        return result.scalar_one() or 0

    async def sum_garden_minutes(self, user_id: str) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(GardenPlant.minutes_together), 0))
            .join(Friendship, Friendship.id == GardenPlant.friendship_id)
            .where(or_(Friendship.user_low_id == user_id, Friendship.user_high_id == user_id))
        )
        return int(result.scalar_one() or 0)

    async def get_group_sessions_started(self, user_id: str) -> int:
        contador = await self.get_or_create_counter(user_id)
        return contador.group_sessions_started
