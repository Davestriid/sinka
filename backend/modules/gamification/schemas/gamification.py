from datetime import date
from pydantic import BaseModel


class UserStatsResponse(BaseModel):
    user_id: str
    username: str
    xp_total: int
    level: int
    xp_current_level: int
    xp_next_level: int
    xp_progress_pct: float
    streak_current: int
    streak_max: int
    sessions_completed: int
    pomodoros_completed: int
    focus_coins: int
    last_session_date: date | None

    model_config = {"from_attributes": True}


class XPAwardResult(BaseModel):
    """Resultado de otorgar XP + FC después de una sesión."""
    xp_earned: int
    xp_total: int
    level_before: int
    level_after: int
    leveled_up: bool
    streak_before: int
    streak_after: int
    streak_increased: bool
    streak_broken: bool
    fc_earned: int
    focus_coins: int


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    xp_total: int
    level: int
    streak_current: int


# ── Tienda ────────────────────────────────────────────────────────────────────

class ShopItemResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    price_fc: int
    preview: str
    owned: bool = False

    model_config = {"from_attributes": True}


class BuyItemResponse(BaseModel):
    success: bool
    message: str
    focus_coins_remaining: int
    item_id: str
