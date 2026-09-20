import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, or_, select

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

    async def count_between(self, user_a_id: str, user_b_id: str) -> int:
        """
        Cuantas veces se han emparejado dos personas, en cualquier orden.

        El emparejamiento guarda a quien entro primero como user_a, asi que la
        misma pareja puede aparecer en las dos combinaciones. Se consultan las
        dos para no contar de menos.
        """
        misma_pareja = or_(
            and_(Match.user_a_id == user_a_id, Match.user_b_id == user_b_id),
            and_(Match.user_a_id == user_b_id, Match.user_b_id == user_a_id),
        )
        result = await self.db.execute(
            select(func.count()).select_from(Match).where(misma_pareja)
        )
        return int(result.scalar_one() or 0)

    async def update_status(self, match_id: str, status: str) -> None:
        match = await self.get_by_id(match_id)
        if match:
            match.status = status
            await self.db.commit()
