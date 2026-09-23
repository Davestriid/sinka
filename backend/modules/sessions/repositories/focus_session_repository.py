import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.sessions.models import FocusSession


class FocusSessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        session_id: str,
        match_id: str,
        user_a_id: str,
        user_b_id: str,
    ) -> FocusSession:
        focus_session = FocusSession(
            id=session_id,
            match_id=match_id,
            user_a_id=user_a_id,
            user_b_id=user_b_id,
            status="active",
            is_active=True,
        )
        self.db.add(focus_session)
        await self.db.commit()
        await self.db.refresh(focus_session)
        return focus_session

    async def get_by_id(self, session_id: str) -> FocusSession | None:
        result = await self.db.execute(
            select(FocusSession).where(FocusSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_active_by_user(self, user_id: str) -> FocusSession | None:
        """
        La sesion activa mas reciente de esta persona.

        Antes se exigia que hubiera una sola y el servidor respondia con un
        error si encontraba mas. Eso pasa de verdad: una sesion que se
        abandona sin cerrarse bien queda marcada como activa, asi que basta
        con un par de sesiones interrumpidas para que esta consulta reviente.
        Ahora se devuelve la ultima y las viejas simplemente se ignoran.
        """
        result = await self.db.execute(
            select(FocusSession)
            .where(
                FocusSession.is_active == True,  # noqa: E712
                (FocusSession.user_a_id == user_id) | (FocusSession.user_b_id == user_id),
            )
            .order_by(FocusSession.started_at.desc())
            .limit(1)
        )
        return result.scalars().first()

    async def end_session(self, session_id: str) -> None:
        session = await self.get_by_id(session_id)
        if session and session.is_active:
            now = datetime.now(timezone.utc)
            elapsed = int((now - session.started_at.replace(tzinfo=timezone.utc)).total_seconds())
            session.is_active = False
            session.status = "completed"
            session.ended_at = now
            session.duration_seconds = elapsed
            await self.db.commit()
