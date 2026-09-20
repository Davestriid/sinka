import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class UserStats(Base):
    """
    Estadísticas de gamificación por usuario.
    Una fila por usuario, upsert en cada sesión completada.
    """
    __tablename__ = "user_stats"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    xp_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    streak_current: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    streak_max: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sessions_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pomodoros_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # FocusCoins: moneda interna ganada completando sesiones
    focus_coins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Confianza: baja al abandonar sesiones, sube al completarlas.
    # Solo afecta la prioridad en el emparejamiento, nunca el acceso.
    trust_score: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    sessions_abandoned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Fecha UTC de la última sesión completada (para cálculo de racha)
    last_session_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ShopItem(Base):
    """
    Ítem cosmético disponible en la tienda.
    Seed data: se inserta manualmente o vía script.
    """
    __tablename__ = "shop_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    # Categoría: "plant_skin" | "background" | "avatar_frame" | "music"
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    price_fc: Mapped[int] = mapped_column(Integer, nullable=False)   # precio en FocusCoins
    # Emoji o URL de preview para el frontend
    preview: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UserInventory(Base):
    """
    Items comprados por cada usuario.
    Un registro por (user_id, item_id); unique para evitar duplicados.
    """
    __tablename__ = "user_inventory"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("shop_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SessionPenalty(Base):
    """
    Registro de cada abandono. Sirve para que el usuario pueda ver por que
    bajo su puntaje, en vez de encontrarse con un numero sin explicacion.
    """

    __tablename__ = "session_penalties"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False, default="normal")
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minutes_elapsed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
