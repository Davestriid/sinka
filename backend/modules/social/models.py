"""
Modelos del modulo social: amistades y jardin de vinculos.

Una amistad guarda la relacion entre dos personas. Cada amistad aceptada
tiene una planta asociada que crece cuando esas dos personas completan
sesiones juntas. La planta es la representacion visible del vinculo: no
crece por acumular contactos sino por sostener la relacion en el tiempo.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

# Estados posibles de una amistad
PENDING = "pending"
ACCEPTED = "accepted"
REJECTED = "rejected"
BLOCKED = "blocked"


class Friendship(Base):
    """
    Relacion entre dos usuarios.

    requester_id es quien envio la solicitud y addressee_id quien la recibe.
    El par (requester, addressee) se guarda siempre ordenado para que no
    puedan existir dos filas describiendo la misma relacion al reves.
    """

    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_low_id", "user_high_id", name="uq_friendship_par"),
        Index("ix_friendships_status", "status"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Par ordenado alfabeticamente. Evita duplicados A-B / B-A.
    user_low_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_high_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Quien inicio la solicitud y quien debe responderla
    requester_id: Mapped[str] = mapped_column(String(36), nullable=False)
    addressee_id: Mapped[str] = mapped_column(String(36), nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=PENDING)

    # Si alguien bloquea, se guarda quien lo hizo para poder revertirlo solo el
    blocked_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    plant: Mapped["GardenPlant | None"] = relationship(
        back_populates="friendship", cascade="all, delete-orphan", uselist=False
    )

    @staticmethod
    def ordenar(user_a: str, user_b: str) -> tuple[str, str]:
        """Devuelve el par ordenado para que A-B y B-A sean la misma fila."""
        return (user_a, user_b) if user_a < user_b else (user_b, user_a)

    def otro(self, user_id: str) -> str:
        """El id de la otra persona de la relacion."""
        return self.user_high_id if user_id == self.user_low_id else self.user_low_id


class GardenPlant(Base):
    """
    Planta asociada a una amistad.

    nourishment es el abono acumulado, que sube con cada sesion completada
    entre ambos. Al superar el costo de la fase actual, la planta avanza.
    """

    __tablename__ = "garden_plants"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    friendship_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("friendships.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Nombre que los dos amigos le ponen a su planta
    name: Mapped[str | None] = mapped_column(String(60), nullable=True)

    phase: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nourishment: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    sessions_together: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minutes_together: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    last_watered_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    friendship: Mapped["Friendship"] = relationship(back_populates="plant")


class FriendRequestQuota(Base):
    """
    Cuota diaria de solicitudes de amistad.

    Cada usuario dispone de tres por dia. El contador se guarda por fecha,
    de modo que se reinicia solo al cambiar el dia sin necesidad de una
    tarea programada que limpie nada.
    """

    __tablename__ = "friend_request_quotas"
    __table_args__ = (
        UniqueConstraint("user_id", "quota_date", name="uq_cuota_usuario_dia"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quota_date: Mapped[date] = mapped_column(Date, nullable=False)
    used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
