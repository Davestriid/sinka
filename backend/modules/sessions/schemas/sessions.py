from datetime import datetime

from pydantic import BaseModel


class FocusSessionResponse(BaseModel):
    id: str
    match_id: str
    user_a_id: str
    user_b_id: str
    status: str
    is_active: bool
    started_at: datetime
    ended_at: datetime | None = None

    model_config = {"from_attributes": True}


class SessionMessageIn(BaseModel):
    """Mensajes que el cliente envia por el WS de sesion."""
    type: str
    payload: dict = {}


class FocusStatusUpdate(BaseModel):
    """
    El cliente envia esto cada ~10 segundos para indicar su nivel de enfoque.
    Usado en Sprint 3 para el motor de la planta.
    """
    session_id: str
    focus_score: float  # 0.0 - 1.0
    is_active: bool
    timestamp: int
