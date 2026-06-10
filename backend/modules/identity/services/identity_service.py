from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext

from core.config import settings
from modules.identity.models import User
from modules.identity.repositories.user_repository import SessionRepository, UserRepository
from modules.identity.schemas.auth import TokenResponse, UserResponse

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class IdentityService:
    def __init__(self, user_repo: UserRepository, session_repo: SessionRepository) -> None:
        self.user_repo = user_repo
        self.session_repo = session_repo

    # ── Contraseñas ──────────────────────────────────────────────────────────────────────

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    # ── JWT ──────────────────────────────────────────────────────────────────────────────

    def create_access_token(self, user_id: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )
        return jwt.encode(
            {"sub": user_id, "exp": expire, "type": "access"},
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )

    def create_refresh_token(self, user_id: str) -> tuple[str, datetime]:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.jwt_refresh_token_expire_days
        )
        token = jwt.encode(
            {"sub": user_id, "exp": expire, "type": "refresh"},
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        return token, expire

    def decode_token(self, token: str) -> dict:
        try:
            return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        except InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # ── Casos de uso ───────────────────────────────────────────────────────────────────

    async def register(self, email: str, username: str, password: str) -> TokenResponse:
        if await self.user_repo.email_exists(email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El correo electrónico ya está registrado.",
            )
        if await self.user_repo.username_exists(username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El nombre de usuario ya está en uso.",
            )

        user = await self.user_repo.create(
            email=email,
            username=username,
            hashed_password=self.hash_password(password),
        )
        return await self._issue_tokens(user)

    async def login(self, email: str, password: str) -> TokenResponse:
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No encontramos una cuenta con ese correo.",
            )
        if not self.verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Contraseña incorrecta. Inténtalo de nuevo.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cuenta desactivada.",
            )
        return await self._issue_tokens(user)

    async def get_current_user(self, token: str) -> UserResponse:
        payload = self.decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")
        user = await self.user_repo.get_by_id(payload["sub"])
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado.")
        return UserResponse.model_validate(user)

    async def _issue_tokens(self, user: User) -> TokenResponse:
        access_token = self.create_access_token(user.id)
        refresh_token, expires_at = self.create_refresh_token(user.id)
        await self.session_repo.create(
            user_id=user.id,
            refresh_token=refresh_token,
            expires_at=expires_at,
        )
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
