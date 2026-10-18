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

    # --- Panel de administracion ------------------------------------------
    # "usuario" | "admin" | "superadmin". Solo un superadmin puede otorgar
    # o quitar el rol de admin a otra persona (ver modules/admin).
    role:      Mapped[str]  = mapped_column(String(20), nullable=False, default="usuario")
    is_banned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- Verificacion de correo --------------------------------------------
    # No se bloquea el login por esto (cuentas viejas quedarian fuera de
    # golpe) — es informativo: el panel admin y el propio usuario pueden ver
    # si el correo fue confirmado. El token es de un solo uso y expira; se
    # limpia (vuelve a None) en cuanto se confirma. Ver core/email.py y
    # IdentityService.verificar_email / reenviar_verificacion.
    email_verified:              Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_verification_token:    Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    email_verification_expires:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Perfil visible para otros usuarios -------------------------------
    # alias: nombre que se muestra en la sesion. Si esta vacio se usa username.
    alias:      Mapped[str | None] = mapped_column(String(50),  nullable=True)
    # Texto largo porque aqui puede ir una imagen cargada por la persona,
    # no solo una direccion web. Ver migracion 0010.
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio:        Mapped[str | None] = mapped_column(String(280), nullable=True)

    # Banner del perfil publico: color propio elegido libremente (hex), o un
    # item de la tienda ya comprado y "equipado" (tiene prioridad sobre el
    # color si esta presente). Ver migracion 0021 y modules/gamification
    # (categoria "profile_banner" de shop_items).
    banner_color: Mapped[str | None] = mapped_column(String(9), nullable=True)
    equipped_banner_item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("shop_items.id", ondelete="SET NULL"), nullable=True,
    )

    # Mismo mecanismo que el banner, para el resto de categorias de la
    # tienda que se "usan" en algun lugar real de la app.
    equipped_background_item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("shop_items.id", ondelete="SET NULL"), nullable=True,
    )
    equipped_avatar_frame_item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("shop_items.id", ondelete="SET NULL"), nullable=True,
    )
    equipped_music_item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("shop_items.id", ondelete="SET NULL"), nullable=True,
    )
    # plant_skin: la planta es de un VINCULO entre dos personas, asi que esto
    # NO cambia los datos de la planta ni lo que ve la otra persona — es
    # nada mas "con que piel visual dibujo YO las plantas que veo", resuelto
    # enteramente en el frontend (ver components/PlantSkin.tsx). Antes
    # quedaba sin conectar por esto mismo; ver migracion 0026.
    equipped_plant_skin_item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("shop_items.id", ondelete="SET NULL"), nullable=True,
    )

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
