"""
Pruebas del puntaje de confianza.

La penalizacion debe ser proporcionada: nunca bloquea el acceso, pesa mas
cuando el abandono es temprano, y siempre deja camino de vuelta.
"""
import pytest

from modules.gamification.services import trust_service as t


# ---------------------------------------------------------------------------
# Penalizacion
# ---------------------------------------------------------------------------

def test_abandonar_baja_el_puntaje():
    r = t.penalizar_abandono(100, "normal", minutos_transcurridos=15)

    assert r.score < 100
    assert r.delta < 0


def test_cada_nivel_castiga_distinto():
    suave    = t.penalizar_abandono(100, "suave",    minutos_transcurridos=15)
    normal   = t.penalizar_abandono(100, "normal",   minutos_transcurridos=15)
    estricto = t.penalizar_abandono(100, "estricto", minutos_transcurridos=15)

    assert suave.score > normal.score > estricto.score


def test_irse_al_principio_duele_mas_que_irse_al_final():
    """
    Irse a los dos minutos deja al companero sin sesion. Irse a los veinte,
    con casi todo hecho, es mucho menos grave.
    """
    temprano = t.penalizar_abandono(100, "normal", minutos_transcurridos=2)
    tardio   = t.penalizar_abandono(100, "normal", minutos_transcurridos=20)

    assert temprano.score < tardio.score


def test_el_puntaje_nunca_baja_de_cero():
    r = t.penalizar_abandono(2, "estricto", minutos_transcurridos=0)

    assert r.score == t.PUNTAJE_MINIMO
    assert r.score >= 0


def test_una_severidad_desconocida_usa_la_normal():
    raro   = t.penalizar_abandono(100, "inventada", minutos_transcurridos=15)  # type: ignore[arg-type]
    normal = t.penalizar_abandono(100, "normal",    minutos_transcurridos=15)

    assert raro.score == normal.score


# ---------------------------------------------------------------------------
# Recuperacion
# ---------------------------------------------------------------------------

def test_completar_sesiones_recupera_confianza():
    r = t.recuperar_por_sesion(50)

    assert r.score > 50
    assert r.delta > 0


def test_el_puntaje_no_pasa_del_maximo():
    r = t.recuperar_por_sesion(t.PUNTAJE_MAXIMO)

    assert r.score == t.PUNTAJE_MAXIMO
    assert r.delta == 0


def test_recuperar_cuesta_mas_que_perder():
    """Reconstruir la confianza es lento a proposito, pero siempre posible."""
    perdida  = abs(t.penalizar_abandono(100, "normal", 15).delta)
    ganancia = t.recuperar_por_sesion(50).delta

    assert ganancia < perdida


def test_desde_cero_se_puede_volver_al_maximo():
    puntaje = 0
    sesiones = 0
    while puntaje < t.PUNTAJE_MAXIMO and sesiones < 200:
        puntaje = t.recuperar_por_sesion(puntaje).score
        sesiones += 1

    assert puntaje == t.PUNTAJE_MAXIMO


# ---------------------------------------------------------------------------
# Niveles y consecuencias
# ---------------------------------------------------------------------------

def test_los_niveles_van_de_mayor_a_menor():
    assert t.nivel_de(95) == "excelente"
    assert t.nivel_de(80) == "bueno"
    assert t.nivel_de(65) == "regular"
    assert t.nivel_de(30) == "bajo"


def test_el_puntaje_bajo_solo_afecta_la_prioridad():
    """Nunca bloquea el acceso, solo deja al usuario para el final de la cola."""
    estado = t.estado(10)

    assert estado["low_priority"] is True
    assert "blocked" not in estado
    assert "banned" not in estado


def test_con_puntaje_alto_no_hay_aviso_ni_baja_prioridad():
    estado = t.estado(100)

    assert estado["low_priority"] is False
    assert estado["should_warn"] is False


def test_el_aviso_aparece_antes_que_la_baja_prioridad():
    """Se avisa a tiempo, no cuando el dano ya esta hecho."""
    assert t.UMBRAL_AVISO > t.UMBRAL_BAJA_PRIORIDAD

    intermedio = t.estado((t.UMBRAL_AVISO + t.UMBRAL_BAJA_PRIORIDAD) // 2)
    assert intermedio["should_warn"] is True
    assert intermedio["low_priority"] is False
