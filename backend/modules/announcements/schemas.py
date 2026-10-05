from datetime import datetime

from pydantic import BaseModel


class AnnouncementPublic(BaseModel):
    """Lo que ve cualquier usuario logueado — sin quien lo creo ni si esta activo."""
    id: str
    titulo: str
    mensaje: str
    created_at: datetime

    model_config = {"from_attributes": True}
