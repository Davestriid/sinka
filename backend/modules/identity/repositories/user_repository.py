from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.identity.models import User, UserSession


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, email: str, username: str, hashed_password: str) -> User:
        user = User(email=email, username=username, hashed_password=hashed_password)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        result = await self.db.execute(select(User.id).where(User.email == email))
        return result.scalar_one_or_none() is not None

    async def username_exists(self, username: str) -> bool:
        result = await self.db.execute(select(User.id).where(User.username == username))
        return result.scalar_one_or_none() is not None


class SessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, user_id: str, refresh_token: str, expires_at) -> UserSession:
        session = UserSession(user_id=user_id, refresh_token=refresh_token, expires_at=expires_at)
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_by_refresh_token(self, token: str) -> UserSession | None:
        result = await self.db.execute(
            select(UserSession).where(
                UserSession.refresh_token == token,
                UserSession.is_revoked.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def revoke(self, session: UserSession) -> None:
        session.is_revoked = True
        await self.db.commit()
