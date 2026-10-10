import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Report(Base):
    """
    Buzón de moderación: un reporte de un usuario sobre otro, o un mensaje
    general (queja/sugerencia) sin usuario reportado — ambos viven en la
    misma tabla porque el panel de admin los trata igual (mismo flujo de
    estados), y distinguirlos solo requiere el campo `tipo`.

    "reported_user_id" es obligatorio cuando tipo="reporte_usuario" y nulo
    en cualquier otro caso — se valida en el service, no aqui, porque un
    CHECK condicional en SQLite/Postgres mixto complica mas de lo que evita.

    Nace en "pendiente". Un admin lo mueve a "revisado" (se tomo una accion,
    tipicamente banear al reportado desde el panel) o "descartado" (no
    ameritaba accion). No se borra nunca: queda como rastro de moderacion.
    """
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    reporter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reported_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # "reporte_usuario" | "queja" | "sugerencia" | "otro"
    tipo:    Mapped[str] = mapped_column(String(30), nullable=False, default="reporte_usuario")
    reason:  Mapped[str] = mapped_column(String(60), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "pendiente" | "revisado" | "descartado"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")

    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Respuesta de un admin, visible para quien envio el mensaje (GET /reports/mine).
    # Responder no es lo mismo que resolver: se puede responder sin cambiar el
    # estado, pero el service de admin por defecto marca "revisado" al
    # responder porque en la practica siempre implica que ya se atendio.
    admin_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    replied_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replied_by:  Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
