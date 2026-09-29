from datetime import datetime

from pydantic import BaseModel


class AchievementOut(BaseModel):
    """Un logro del catalogo, con el progreso del usuario que lo pide."""

    id: str
    category: str
    name_es: str
    name_en: str
    description_es: str
    description_en: str
    icon: str
    reward_fc: int
    target: int
    progress: int
    unlocked: bool
    unlocked_at: datetime | None = None


class AchievementsSummary(BaseModel):
    """Resumen para mostrar arriba de la grilla: cuántos de cuántos."""

    total: int
    unlocked: int
    achievements: list[AchievementOut]
