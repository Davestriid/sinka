from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext

from core.config import settings
from modules.identity.models import User
from modules.identity.repositories.user_repository import SessionRepository, UserRepository
from modules.identity.schemas.auth import (
    PublicBadge,
    PublicProfile,
    PublicProfileFull,
    TokenResponse,
    UserResponse,
)

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

        # Correo inexistente y contraseña incorrecta devuelven la misma respuesta.
        # Distinguirlas permitiria averiguar que correos tienen cuenta en SINKA.
        credenciales_invalidas = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        if not user:
            raise credenciales_invalidas
        if not self.verify_password(password, user.hashed_password):
            raise credenciales_invalidas
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cuenta desactivada.",
            )
        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta cuenta fue suspendida.",
            )
        return await self._issue_tokens(user)

    async def get_current_user(self, token: str) -> UserResponse:
        payload = self.decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")
        user = await self.user_repo.get_by_id(payload["sub"])
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado.")
        if user.is_banned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esta cuenta fue suspendida.")
        return UserResponse.model_validate(user)

    # ------------------------------------------------------------------
    # Perfil y onboarding
    # ------------------------------------------------------------------

    async def update_profile(self, user_id: str, cambios: dict) -> UserResponse:
        """Actualizacion parcial del perfil. Solo toca los campos enviados."""
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        user = await self.user_repo.update_fields(user, **cambios)
        return UserResponse.model_validate(user)

    async def complete_onboarding(
        self,
        user_id:    str,
        alias:      str,
        avatar_url: str | None,
        interests:  list[str],
        language:   str,
    ) -> UserResponse:
        """
        Cierra el onboarding de cuatro pasos y marca la cuenta como lista.
        Solo se ejecuta una vez; si ya estaba completo devuelve el perfil actual.
        """
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        if user.onboarding_completed:
            return UserResponse.model_validate(user)

        user.alias = alias
        user.avatar_url = avatar_url
        user.interests = interests
        user.language = language
        user.onboarding_completed = True

        user = await self.user_repo.update_fields(user)
        return UserResponse.model_validate(user)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        """
        Cambia un token de refresco por uno de acceso nuevo.

        Sin esto la sesion moria a la media hora y la persona tenia que volver
        a escribir su contraseña aunque no hubiera cerrado sesion.

        El token viejo se revoca y se entrega uno nuevo. Asi, si alguien roba
        un token de refresco, solo le sirve hasta que la persona legitima lo
        use otra vez.
        """
        invalido = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesion expiro. Vuelve a iniciar sesion.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        payload = self.decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise invalido

        sesion = await self.session_repo.get_by_refresh_token(refresh_token)
        if sesion is None:
            raise invalido

        user = await self.user_repo.get_by_id(payload.get("sub", ""))
        if user is None or not user.is_active:
            raise invalido

        await self.session_repo.revoke(sesion)
        return await self._issue_tokens(user)

    async def search_users(self, termino: str, actual_id: str) -> list[UserResponse]:
        """Busqueda de usuarios por nombre. Minimo dos caracteres."""
        termino = termino.strip()
        if len(termino) < 2:
            return []
        encontrados = await self.user_repo.search(termino, excluir_id=actual_id)
        return [UserResponse.model_validate(u) for u in encontrados]

    async def get_public_profile(self, user_id: str) -> PublicProfile:
        """
        Perfil publico minimo de otra persona: nombre y foto para mostrar en
        pantalla (por ejemplo, la pareja de una sesion), nunca su correo.
        """
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese usuario no existe.")
        return PublicProfile.model_validate(user)

    async def get_public_profile_full(self, user_id: str) -> PublicProfileFull:
        """
        "Tarjeta de jugador" de otra persona: lo mismo que get_public_profile
        mas nivel/XP, racha, sesiones y logros desbloqueados — se usa cuando
        alguien toca la foto de otra persona en vinculos, grupos o el ranking.

        Importado aca adentro (no arriba del archivo) para evitar un ciclo de
        imports a nivel de modulo: gamification y achievements no dependen de
        identity_service, pero varios de sus __init__ de paquete si recorren
        bastante al cargarse, y mantenerlo perezoso evita tener que pensar en
        el orden de carga de modules/main.py.
        """
        from modules.achievements.services.achievements_service import achievements_service
        from modules.gamification.repositories.gamification_repository import (
            GamificationRepository,
        )
        from modules.gamification.services.gamification_service import compute_xp_progress

        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese usuario no existe.")

        stats = await GamificationRepository(self.user_repo.db).get_by_user_id(user_id)
        xp_total = stats.xp_total if stats else 0
        level = stats.level if stats else 1
        xp_in_level, xp_next, pct = compute_xp_progress(xp_total, level)

        resumen = await achievements_service.get_summary(user_id)
        badges = [
            PublicBadge(id=a["id"], name_es=a["name_es"], name_en=a["name_en"], icon=a["icon"])
            for a in resumen["achievements"]
            if a["unlocked"]
        ]

        return PublicProfileFull(
            id=user.id,
            username=user.username,
            alias=user.alias,
            avatar_url=user.avatar_url,
            bio=user.bio,
            member_since=user.created_at,
            level=level,
            xp_total=xp_total,
            xp_in_level=xp_in_level,
            xp_for_next_level=xp_next,
            xp_progress_pct=pct,
            streak_current=stats.streak_current if stats else 0,
            streak_max=stats.streak_max if stats else 0,
            sessions_completed=stats.sessions_completed if stats else 0,
            pomodoros_completed=stats.pomodoros_completed if stats else 0,
            achievements_unlocked=resumen["unlocked"],
            achievements_total=resumen["total"],
            badges=badges,
        )

    async def _issue_tokens(self, user: User) -> TokenResponse:
        access_token = self.create_access_token(user.id)
        refresh_token, expires_at = self.create_refresh_token(user.id)
        await self.session_repo.create(
            user_id=user.id,
            refresh_token=refresh_token,
            expires_at=expires_at,
        )
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
