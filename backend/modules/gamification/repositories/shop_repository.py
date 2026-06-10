from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.gamification.models import ShopItem, UserInventory


class ShopRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_active(self) -> list[ShopItem]:
        result = await self.db.execute(
            select(ShopItem).where(ShopItem.is_active.is_(True)).order_by(ShopItem.category, ShopItem.price_fc)
        )
        return list(result.scalars().all())

    async def get_by_id(self, item_id: str) -> ShopItem | None:
        result = await self.db.execute(
            select(ShopItem).where(ShopItem.id == item_id)
        )
        return result.scalar_one_or_none()

    async def get_user_inventory(self, user_id: str) -> set[str]:
        """Devuelve el set de item_ids que posee el usuario."""
        result = await self.db.execute(
            select(UserInventory.item_id).where(UserInventory.user_id == user_id)
        )
        return set(result.scalars().all())

    async def owns_item(self, user_id: str, item_id: str) -> bool:
        result = await self.db.execute(
            select(UserInventory).where(
                UserInventory.user_id == user_id,
                UserInventory.item_id == item_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def add_to_inventory(self, user_id: str, item_id: str) -> UserInventory:
        entry = UserInventory(user_id=user_id, item_id=item_id)
        self.db.add(entry)
        await self.db.flush()
        return entry
