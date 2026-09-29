"""
Modelos del modulo de logros.

El catalogo de logros (que existen, su condicion, su recompensa) no vive en
la base de datos: es una lista fija en services/achievements_service.py,
igual que las fases del jardin en el modulo social. Aca solo se guarda lo
que SI cambia por usuario:

- UserAchievement: que logros ya desbloqueo cada quien y cuando.
- AchievementCounter: un puñado de contadores que ningun otro modulo lleva
  todavia (sesiones de grupo, por ejemplo). El resto de las condiciones se
  evalua leyendo directamente user_stats, friendships o garden_plants — no
  tiene sentido duplicar un numero que ya existe en otra tabla.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class UserAchievement(Base):
    """Un logro desbloqueado por un usuario, una sola vez."""

    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Coincide con el "id" del catalogo en achievements_service.py
    achievement_id: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AchievementCounter(Base):
    """
    Contadores propios del modulo, una fila por usuario.

    Solo lleva lo que ningun otro modulo registra todavia. Si mañana el
    modulo de grupos guarda cuantas sesiones grupales completo cada quien,
    esta columna deja de usarse y se lee de ahi en su lugar.
    """

    __tablename__ = "achievement_counters"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    group_sessions_started: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
