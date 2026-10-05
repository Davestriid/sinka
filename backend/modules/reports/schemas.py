from datetime import datetime

from pydantic import BaseModel, Field

TIPOS_VALIDOS = ("reporte_usuario", "queja", "sugerencia", "otro")

RAZONES_VALIDAS = (
    "comportamiento_inapropiado",
    "acoso",
    "abandono_reiterado",
    "spam",
    "otro",
)


class ReportCreate(BaseModel):
    """Reportar a otro usuario. tipo queda fijo en 'reporte_usuario'."""
    reported_user_id: str
    reason: str = Field(description=f"Una de: {RAZONES_VALIDAS}")
    details: str | None = Field(default=None, max_length=500)


class FeedbackCreate(BaseModel):
    """Queja, sugerencia o comentario general — no reporta a nadie."""
    tipo: str = Field(description=f"Una de: {[t for t in TIPOS_VALIDOS if t != 'reporte_usuario']}")
    mensaje: str = Field(min_length=3, max_length=1000)


class ReportResponse(BaseModel):
    id: str
    reporter_id: str
    reported_user_id: str | None
    tipo: str
    reason: str
    details: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
