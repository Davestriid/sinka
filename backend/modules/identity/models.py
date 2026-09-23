import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # --- Perfil visible para otros usuarios -------------------------------
    # alias: nombre que se muestra en la sesion. Si esta vacio se usa username.
    alias:      Mapped[str | None] = mapped_column(String(50),  nullable=True)
    # Texto largo porque aqui puede ir una imagen cargada por la persona,
    # no solo una direccion web. Ver migracion 0010.
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio:        Mapped[str | None] = mapped_column(String(280), nullable=True)

    # --- Preferencias de interfaz ----------------------------------------
    language: Mapped[str] = mapped_column(String(5),  nullable=False, default="es")
    theme:    Mapped[str] = mapped_column(String(10), nullable=False, default="light")

    # --- Onboarding -------------------------------------------------------
    # interests: lista de slugs del catalogo elegidos en el paso 2 del onboarding.
    interests:            Mapped[list | None] = mapped_column(JSON, nullable=True)
    onboarding_completed: Mapped[bool]        = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    sessions: Mapped[list["UserSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    @property
    def display_name(self) -> str:
        """Nombre que ve el companero de sesion."""
        return self.alias or self.username


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship(back_populates="sessions")
