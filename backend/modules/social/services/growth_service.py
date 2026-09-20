"""
Crecimiento de la planta del jardin de vinculos.

Logica pura, sin base de datos ni red, para poder probarla con datos en memoria.

La planta crece con el abono que dejan las sesiones completadas entre dos
amigos. Cada fase cuesta mas que la anterior, asi que llegar al arbol exige
una relacion sostenida y no un par de encuentros sueltos.

Regla de negocio importante: la planta solo existe entre personas que ya son
amigas. Un primer encuentro no genera planta. Eso se valida en la capa de
servicio, no aqui.
"""
from dataclasses import dataclass
from typing import Final

# Fases de la planta, en orden
PHASES: Final[list[str]] = ["semilla", "brote", "planta", "floreciendo", "arbol"]

PHASE_LABELS_ES: Final[dict[str, str]] = {
    "semilla":     "Semilla",
    "brote":       "Brote",
    "planta":      "Planta joven",
    "floreciendo": "Floreciendo",
    "arbol":       "Arbol",
}

PHASE_LABELS_EN: Final[dict[str, str]] = {
    "semilla":     "Seed",
    "brote":       "Sprout",
    "planta":      "Young plant",
    "floreciendo": "Blooming",
    "arbol":       "Tree",
}

PHASE_EMOJI: Final[dict[str, str]] = {
    "semilla":     "\U0001F330",  # castaña
    "brote":       "\U0001F331",  # brote
    "planta":      "\U0001F33F",  # hierba
    "floreciendo": "\U0001F338",  # flor
    "arbol":       "\U0001F333",  # arbol
}

# Abono necesario para salir de cada fase. La ultima no tiene costo porque
# ya no hay a donde subir.
PHASE_COST: Final[list[int]] = [60, 150, 320, 600, 0]

# Un minuto de sesion completada deja un punto de abono
NOURISHMENT_PER_MINUTE: Final[float] = 1.0

# Bono por completar la sesion entera en vez de cortarla a medias
COMPLETION_BONUS: Final[float] = 10.0

# Cuanto multiplica el abono el hecho de regar en dias distintos.
# Premia la constancia por encima de las maratones de un solo dia.
NEW_DAY_MULTIPLIER: Final[float] = 1.5

MAX_PHASE: Final[int] = len(PHASES) - 1


@dataclass
class GrowthResult:
    """Resultado de regar la planta una vez."""

    phase: int
    nourishment: float
    gained: float
    phases_advanced: int
    reached_max: bool

    @property
    def phase_name(self) -> str:
        return PHASES[self.phase]


def phase_name(phase: int) -> str:
    """Nombre interno de la fase, acotado al rango valido."""
    return PHASES[max(0, min(phase, MAX_PHASE))]


def phase_label(phase: int, lang: str = "es") -> str:
    """Etiqueta legible de la fase en el idioma pedido."""
    nombre = phase_name(phase)
    tabla = PHASE_LABELS_EN if lang == "en" else PHASE_LABELS_ES
    return tabla[nombre]


def phase_emoji(phase: int) -> str:
    return PHASE_EMOJI[phase_name(phase)]


def cost_of(phase: int) -> int:
    """Abono necesario para dejar atras esta fase. Cero si ya es la ultima."""
    if phase >= MAX_PHASE:
        return 0
    return PHASE_COST[phase]


def progress_pct(phase: int, nourishment: float) -> float:
    """Avance dentro de la fase actual, entre 0 y 1."""
    costo = cost_of(phase)
    if costo <= 0:
        return 1.0
    return max(0.0, min(1.0, nourishment / costo))


def nourishment_from_session(
    minutes: int,
    completed: bool,
    new_day: bool,
) -> float:
    """
    Cuanto abono deja una sesion.

    minutes:   minutos de foco efectivos
    completed: si la sesion llego al final o se corto antes
    new_day:   si es el primer riego del dia para esta planta
    """
    if minutes <= 0:
        return 0.0

    abono = minutes * NOURISHMENT_PER_MINUTE
    if completed:
        abono += COMPLETION_BONUS
    if new_day:
        abono *= NEW_DAY_MULTIPLIER
    return round(abono, 2)


def water(phase: int, nourishment: float, gained: float) -> GrowthResult:
    """
    Aplica el abono y avanza tantas fases como alcance.

    El sobrante se conserva para la fase siguiente, asi una sesion larga no
    desperdicia el excedente al cruzar el umbral.
    """
    fase = max(0, min(phase, MAX_PHASE))
    acumulado = max(0.0, nourishment) + max(0.0, gained)
    avanzadas = 0

    while fase < MAX_PHASE:
        costo = cost_of(fase)
        if costo <= 0 or acumulado < costo:
            break
        acumulado -= costo
        fase += 1
        avanzadas += 1

    if fase >= MAX_PHASE:
        # En la ultima fase el abono deja de acumularse
        acumulado = 0.0

    return GrowthResult(
        phase=fase,
        nourishment=round(acumulado, 2),
        gained=round(gained, 2),
        phases_advanced=avanzadas,
        reached_max=fase >= MAX_PHASE,
    )
