import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from modules.matchmaking.models import Match


class MatchRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, user_a_id: str, user_b_id: str) -> Match:
        match = Match(
            id=str(uuid.uuid4()),
            user_a_id=user_a_id,
            user_b_id=user_b_id,
            status="active",
        )
        self.db.add(match)
        await self.db.commit()
        await self.db.refresh(match)
        return match

    async def get_by_id(self, match_id: str) -> Match | None:
        result = await self.db.execute(select(Match).where(Match.id == match_id))
        return result.scalar_one_or_none()

    async def update_status(self, match_id: str, status: str) -> None:
        match = await self.get_by_id(match_id)
        if match:
            match.status = status
            await self.db.commit()
