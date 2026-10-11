import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$")


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("El username debe tener entre 3 y 50 caracteres.")
        if not v.replace("_", "").isalnum():
            raise ValueError("El username solo puede contener letras, números y guiones bajos.")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    is_active: bool
    role: str = "usuario"
    is_banned: bool = False

    # Perfil
    alias:      str | None = None
    avatar_url: str | None = None
    bio:        str | None = None

    # Banner del perfil publico: color propio (hex). Si hay un item de
    # tienda equipado, ese tiene prioridad — ver equipped_banner_item_id.
    banner_color:             str | None = None
    equipped_banner_item_id:  str | None = None

    # Preferencias
    language: str = "es"
    theme:    str = "light"

    # Onboarding
    interests:            list[str] | None = None
    onboarding_completed: bool = False

    model_config = {"from_attributes": True}


class PublicProfile(BaseModel):
    """
    Perfil publico minimo de otra persona — nunca su correo. Se usa para
    mostrar nombre y foto de la pareja dentro de una sesion, por ejemplo.
    """

    id:         str
    username:   str
    alias:      str | None = None
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class PublicBadge(BaseModel):
    """Un logro ya desbloqueado, version minima para mostrar en una tarjeta
    de perfil publico — sin progreso ni fecha, eso vive en /achievements."""

    id:      str
    name_es: str
    name_en: str
    icon:    str


class PublicProfileFull(BaseModel):
    """
    Perfil publico completo de otra persona: lo mismo que PublicProfile mas
    estadisticas y logros — la "tarjeta de jugador" al estilo Clash Royale
    que se ve al tocar la foto de alguien en vinculos, grupos o el ranking.

    Todo aca es informacion que cualquiera puede ver sin comprometer
    privacidad: nunca el correo. El puntaje de confianza SI se muestra aca
    (decision explicita del producto) — ya no se oculta como antes.
    """

    id:         str
    username:   str
    alias:      str | None = None
    avatar_url: str | None = None
    bio:        str | None = None
    member_since: datetime

    level:              int
    xp_total:           int
    xp_in_level:        int
    xp_for_next_level:  int
    xp_progress_pct:    float

    streak_current:      int
    streak_max:          int
    sessions_completed:  int
    pomodoros_completed: int

    # Confianza: numero exacto (0-100) y su nivel legible ("excelente",
    # "bueno", "regular", "bajo"). Ver modules/gamification/services/trust_service.
    trust_score: int
    trust_level: str

    # Banner: si hay un item de tienda equipado, banner_preview trae su
    # valor CSS (color o degradado) y tiene prioridad sobre banner_color,
    # el color propio elegido libremente.
    banner_color:   str | None = None
    banner_preview: str | None = None

    achievements_unlocked: int
    achievements_total:    int
    badges: list[PublicBadge]

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    """Actualizacion parcial del perfil. Todo opcional."""

    alias:        str | None = None
    avatar_url:   str | None = None
    bio:          str | None = None
    banner_color: str | None = None
    language:     str | None = None
    theme:        str | None = None

    @field_validator("banner_color")
    @classmethod
    def banner_color_hex(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if not HEX_COLOR_RE.match(v):
            raise ValueError("El color del banner debe ser un hex valido, ej. #4a90d9.")
        return v

    @field_validator("alias")
    @classmethod
    def alias_length(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if len(v) < 2 or len(v) > 24:
            raise ValueError("El alias debe tener entre 2 y 24 caracteres.")
        return v

    @field_validator("bio")
    @classmethod
    def bio_length(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) > 280:
            raise ValueError("La biografia no puede superar los 280 caracteres.")
        return v or None

    @field_validator("language")
    @classmethod
    def language_supported(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from core.catalog import LANGUAGES

        if v not in LANGUAGES:
            raise ValueError(f"Idioma no soportado. Opciones: {sorted(LANGUAGES)}")
        return v

    @field_validator("theme")
    @classmethod
    def theme_supported(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from core.catalog import THEMES

        if v not in THEMES:
            raise ValueError(f"Tema no soportado. Opciones: {sorted(THEMES)}")
        return v


class OnboardingRequest(BaseModel):
    """
    Cierre del onboarding de cuatro pasos.

    Paso 1 entrega alias y avatar, paso 2 los intereses, paso 3 solo explica
    como funciona y el paso 4 confirma. El frontend envia todo junto al final.
    """

    alias:      str
    avatar_url: str | None = None
    interests:  list[str] = []
    language:   str = "es"

    @field_validator("alias")
    @classmethod
    def alias_required(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 24:
            raise ValueError("El alias debe tener entre 2 y 24 caracteres.")
        return v

    @field_validator("interests")
    @classmethod
    def interests_valid(cls, v: list[str]) -> list[str]:
        from core.catalog import is_valid_topic

        limpio = [s for s in dict.fromkeys(v) if is_valid_topic(s)]
        if len(limpio) > 5:
            raise ValueError("Puedes elegir un maximo de 5 intereses.")
        return limpio
