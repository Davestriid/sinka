"""
Modelos de citas programadas.

Una cita es un acuerdo para trabajar juntos a una hora concreta. Puede ser
entre dos amigos o abierta a los integrantes de un grupo.

El cupo diario existe para que agendar signifique algo. Si alguien pudiera
llenar su semana de citas, dejaria de tratarse de un compromiso y pasaria a
ser una lista de buenas intenciones.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base

# Estados de una cita
PENDING = "pending"       # invitada, sin responder
CONFIRMED = "confirmed"   # aceptada por la otra parte
DECLINED = "declined"     # rechazada
CANCELLED = "cancelled"   # anulada por quien la creo
COMPLETED = "completed"   # ya ocurrio
EXPIRED = "expired"       # paso la hora sin que nadie respondiera

ESTADOS_VIVOS = (PENDING, CONFIRMED)

# Cuantas citas puede crear una persona por dia
CUPO_DIARIO = 3


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_scheduled_for", "scheduled_for"),
        Index("ix_appointments_status", "status"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    creator_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Una cita apunta a una persona o a un grupo, nunca a los dos
    invitee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    group_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=True, index=True
    )

    title: Mapped[str | None] = mapped_column(String(80), nullable=True)
    topic: Mapped[str] = mapped_column(String(30), nullable=False)

    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=25)

    status: Mapped[str] = mapped_column(String(15), nullable=False, default=PENDING)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Id de la sesion real que nacio de esta cita, si llego a ocurrir
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    @property
    def is_group(self) -> bool:
        return self.group_id is not None

    def participa(self, user_id: str) -> bool:
        """Si esta persona esta implicada en la cita."""
        return user_id in (self.creator_id, self.invitee_id)


class AppointmentQuota(Base):
    """
    Cupo diario de citas creadas.

    Igual que la cuota de solicitudes de amistad, se guarda por fecha para que
    se reinicie sola al cambiar el dia.
    """

    __tablename__ = "appointment_quotas"
    __table_args__ = (
        UniqueConstraint("user_id", "quota_date", name="uq_cupo_citas_dia"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quota_date: Mapped[date] = mapped_column(Date, nullable=False)
    used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
