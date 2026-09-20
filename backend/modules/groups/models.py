"""
Modelos del modulo de grupos.

Un grupo reune a varias personas que trabajan sobre un mismo tema. Puede ser
publico, y entonces cualquiera lo encuentra al explorar, o privado, y entonces
solo se entra con el codigo de invitacion.

La regla de la pantalla compartida nace de la confianza: en un grupo abierto a
desconocidos, mostrar la pantalla es la forma de que el acompanamiento sea real
y no solo una ventana con la camara encendida.
"""
import secrets
import string
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

# Visibilidad del grupo
PUBLIC = "public"
PRIVATE = "private"

# Rol dentro del grupo
OWNER = "owner"
MEMBER = "member"

MAX_MEMBERS = 8
INVITE_CODE_LENGTH = 8


def generar_codigo() -> str:
    """
    Codigo de invitacion legible.

    Se excluyen los caracteres que se confunden al dictarlos en voz alta
    (0, O, 1, I, L) porque el codigo se comparte por chat o de palabra.
    """
    alfabeto = "".join(c for c in string.ascii_uppercase + string.digits if c not in "O0I1L")
    return "".join(secrets.choice(alfabeto) for _ in range(INVITE_CODE_LENGTH))


class Group(Base):
    __tablename__ = "groups"
    __table_args__ = (
        Index("ix_groups_visibility_topic", "visibility", "topic"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Categoria del catalogo compartido
    topic: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    visibility: Mapped[str] = mapped_column(String(10), nullable=False, default=PUBLIC)

    # Codigo para entrar a los grupos privados
    invite_code: Mapped[str] = mapped_column(
        String(12), nullable=False, unique=True, index=True, default=generar_codigo
    )

    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Tarea comun del grupo. En los privados se puede personalizar.
    default_task: Mapped[str | None] = mapped_column(String(80), nullable=True)

    max_members: Mapped[int] = mapped_column(Integer, nullable=False, default=MAX_MEMBERS)

    # Si el grupo acepta gente nueva, compartir pantalla pasa a ser obligatorio
    open_to_strangers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )

    @property
    def requires_screen_share(self) -> bool:
        """
        Compartir pantalla es obligatorio cuando el grupo esta abierto a
        desconocidos. En un grupo cerrado entre conocidos no hace falta.
        """
        return self.open_to_strangers


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_miembro_grupo"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False, default=MEMBER)

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    group: Mapped["Group"] = relationship(back_populates="members")
