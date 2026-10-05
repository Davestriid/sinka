"""
A diferencia del resto de modules/admin (que solo lee/escribe modelos de
otros modulos), Setting y AuditLog si son datos propios del panel: no hay
otro modulo al que "pertenezcan".
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Setting(Base):
    """
    Un parametro configurable desde el panel (ej: FocusCoins por pomodoro).

    El valor vive en JSON para no necesitar una columna nueva por cada
    parametro futuro — el mismo truco que ya usa modules/identity para los
    parametros del sistema de logros. Quien lee un Setting en el codigo de
    negocio decide que forma tiene su `value`.
    """
    __tablename__ = "settings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    code:        Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    name:        Mapped[str] = mapped_column(String(120), nullable=False)
    value:       Mapped[dict] = mapped_column(JSON, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AuditLog(Base):
    """
    Rastro de quien hizo que accion de administracion y cuando. Se escribe
    desde AdminService — nunca se edita ni se borra desde el panel.
    """
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    admin_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    accion:         Mapped[str] = mapped_column(String(60), nullable=False)
    objetivo_tipo:  Mapped[str | None] = mapped_column(String(40), nullable=True)
    objetivo_id:    Mapped[str | None] = mapped_column(String(36), nullable=True)
    detalle:        Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
