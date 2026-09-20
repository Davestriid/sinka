"""
Puntaje de confianza y penalizacion por abandono.

Salir a mitad de una sesion deja al companero solo. Este servicio traduce ese
hecho en una consecuencia proporcionada: baja el puntaje de confianza, lo que
afecta la prioridad en el emparejamiento.

Nunca bloquea el acceso a la plataforma. Alguien con puntaje bajo sigue
pudiendo usar SINKA, solo que espera un poco mas para encontrar companero.
Castigar con la expulsion a quien tuvo un mal dia seria desproporcionado.

Logica pura para poder probarla sin base de datos.
"""
from dataclasses import dataclass
from typing import Final, Literal

Severidad = Literal["suave", "normal", "estricto"]

# Puntaje inicial y limites
PUNTAJE_INICIAL: Final[int] = 100
PUNTAJE_MINIMO: Final[int] = 0
PUNTAJE_MAXIMO: Final[int] = 100

# Cuanto descuenta un abandono segun el nivel configurado
DESCUENTO: Final[dict[str, int]] = {
    "suave":    3,
    "normal":   8,
    "estricto": 15,
}

# Cuanto recupera una sesion terminada bien
RECUPERACION_POR_SESION: Final[int] = 2

# Debajo de este puntaje, el emparejamiento deja al usuario para el final
UMBRAL_BAJA_PRIORIDAD: Final[int] = 60

# Debajo de este puntaje se le muestra un aviso en el dashboard
UMBRAL_AVISO: Final[int] = 75

# Un abandono en los primeros minutos duele mas que uno cerca del final
MINUTOS_ABANDONO_TEMPRANO: Final[int] = 5
MULTIPLICADOR_TEMPRANO: Final[float] = 1.5


@dataclass
class TrustResult:
    score: int
    delta: int
    nivel: str
    low_priority: bool
    should_warn: bool


def nivel_de(score: int) -> str:
    """Etiqueta legible del puntaje."""
    if score >= 90:
        return "excelente"
    if score >= UMBRAL_AVISO:
        return "bueno"
    if score >= UMBRAL_BAJA_PRIORIDAD:
        return "regular"
    return "bajo"


def _acotar(score: int) -> int:
    return max(PUNTAJE_MINIMO, min(PUNTAJE_MAXIMO, score))


def _empaquetar(score: int, delta: int) -> TrustResult:
    score = _acotar(score)
    return TrustResult(
        score=score,
        delta=delta,
        nivel=nivel_de(score),
        low_priority=score < UMBRAL_BAJA_PRIORIDAD,
        should_warn=score < UMBRAL_AVISO,
    )


def penalizar_abandono(
    score_actual: int,
    severidad: Severidad = "normal",
    minutos_transcurridos: int = 0,
) -> TrustResult:
    """
    Aplica la penalizacion por salir antes de tiempo.

    Irse a los dos minutos deja al companero sin sesion. Irse a los veinte, con
    casi todo el trabajo hecho, es mucho menos grave. Por eso el abandono
    temprano pesa mas.
    """
    base = DESCUENTO.get(severidad, DESCUENTO["normal"])

    if minutos_transcurridos < MINUTOS_ABANDONO_TEMPRANO:
        base = round(base * MULTIPLICADOR_TEMPRANO)

    return _empaquetar(score_actual - base, -base)


def recuperar_por_sesion(score_actual: int) -> TrustResult:
    """
    Terminar una sesion completa recupera puntaje.

    La recuperacion es lenta a proposito: reconstruir la confianza cuesta mas
    que perderla, pero siempre existe el camino de vuelta.
    """
    if score_actual >= PUNTAJE_MAXIMO:
        return _empaquetar(score_actual, 0)
    return _empaquetar(score_actual + RECUPERACION_POR_SESION, RECUPERACION_POR_SESION)


def estado(score: int) -> dict:
    """Resumen del puntaje tal como lo consume el frontend."""
    resultado = _empaquetar(score, 0)
    return {
        "score":        resultado.score,
        "level":        resultado.nivel,
        "low_priority": resultado.low_priority,
        "should_warn":  resultado.should_warn,
        "max_score":    PUNTAJE_MAXIMO,
    }
