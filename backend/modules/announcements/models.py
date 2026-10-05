import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Announcement(Base):
    """
    Un anuncio enviado desde el panel de administracion a todos los usuarios.

    "Enviar" no dispara correos ni push todavia — se persiste aqui y el
    dashboard muestra el mas reciente que siga `activo` como un banner.
    Un admin puede desactivarlo (ocultarlo) sin borrar el historial.
    """
    __tablename__ = "announcements"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    titulo:  Mapped[str] = mapped_column(String(120), nullable=False)
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    activo:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    creado_por_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
