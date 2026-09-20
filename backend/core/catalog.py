"""
Catalogo de categorias de actividad de SINKA.

Cada usuario elige una categoria antes de buscar companero. El motor de
matchmaking usa esa categoria para emparejar por afinidad: quien programa
trabaja junto a quien programa, quien escribe junto a quien escribe.

Este catalogo es la unica fuente de verdad. Tanto el backend como el
frontend deben consumirlo desde aqui via GET /api/catalog/topics.
"""
from typing import Final, TypedDict


class Topic(TypedDict):
    slug: str
    label_es: str
    label_en: str
    icon: str


TOPICS: Final[list[Topic]] = [
    {"slug": "software",   "label_es": "Desarrollo de software",  "label_en": "Software development", "icon": "code"},
    {"slug": "mobile",     "label_es": "Apps moviles",            "label_en": "Mobile apps",          "icon": "smartphone"},
    {"slug": "web",        "label_es": "Desarrollo web",          "label_en": "Web development",      "icon": "globe"},
    {"slug": "design",     "label_es": "Diseno grafico",          "label_en": "Graphic design",       "icon": "palette"},
    {"slug": "video",      "label_es": "Edicion de video",        "label_en": "Video editing",        "icon": "film"},
    {"slug": "writing",    "label_es": "Escritura",               "label_en": "Writing",              "icon": "pen"},
    {"slug": "drawing",    "label_es": "Dibujo digital",          "label_en": "Digital drawing",      "icon": "brush"},
    {"slug": "music",      "label_es": "Musica y produccion",     "label_en": "Music production",     "icon": "music"},
    {"slug": "marketing",  "label_es": "Marketing digital",       "label_en": "Digital marketing",    "icon": "megaphone"},
    {"slug": "photo",      "label_es": "Fotografia",              "label_en": "Photography",          "icon": "camera"},
    {"slug": "data",       "label_es": "Analisis de datos",       "label_en": "Data analysis",        "icon": "chart"},
    {"slug": "languages",  "label_es": "Idiomas",                 "label_en": "Languages",            "icon": "languages"},
    {"slug": "other",      "label_es": "Otro",                    "label_en": "Other",                "icon": "dots"},
]

TOPIC_SLUGS: Final[frozenset[str]] = frozenset(t["slug"] for t in TOPICS)

DEFAULT_TOPIC: Final[str] = "other"


def is_valid_topic(slug: str | None) -> bool:
    """True si el slug pertenece al catalogo."""
    return slug in TOPIC_SLUGS


def normalize_topic(slug: str | None) -> str:
    """Devuelve un slug valido; cae a 'other' si el valor no existe."""
    return slug if is_valid_topic(slug) else DEFAULT_TOPIC


def label(slug: str, lang: str = "es") -> str:
    """Etiqueta legible de una categoria en el idioma pedido."""
    key = "label_en" if lang == "en" else "label_es"
    for t in TOPICS:
        if t["slug"] == slug:
            return t[key]  # type: ignore[literal-required]
    return slug


# ---------------------------------------------------------------------------
# Idiomas y temas soportados por la interfaz
# ---------------------------------------------------------------------------

LANGUAGES: Final[frozenset[str]] = frozenset({"es", "en"})
THEMES: Final[frozenset[str]] = frozenset({"light", "dark"})

DEFAULT_LANGUAGE: Final[str] = "es"
DEFAULT_THEME: Final[str] = "light"
