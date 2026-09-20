"""
Pruebas del crecimiento de la planta del jardin de vinculos.

Es logica pura, asi que se puede verificar sin base de datos.
"""
import pytest

from modules.social.services import growth_service as g


# ---------------------------------------------------------------------------
# Abono que deja una sesion
# ---------------------------------------------------------------------------

def test_una_sesion_de_25_minutos_completada_deja_abono():
    abono = g.nourishment_from_session(minutes=25, completed=True, new_day=False)
    # 25 minutos + 10 de bono por completarla
    assert abono == 35.0


def test_cortar_la_sesion_pierde_el_bono_de_cierre():
    completa = g.nourishment_from_session(25, completed=True,  new_day=False)
    cortada  = g.nourishment_from_session(25, completed=False, new_day=False)
    assert cortada == 25.0
    assert cortada < completa


def test_regar_en_un_dia_nuevo_rinde_mas():
    """La constancia vale mas que la maraton de un solo dia."""
    mismo_dia = g.nourishment_from_session(25, completed=True, new_day=False)
    dia_nuevo = g.nourishment_from_session(25, completed=True, new_day=True)
    assert dia_nuevo == pytest.approx(mismo_dia * 1.5)


def test_una_sesion_sin_minutos_no_deja_abono():
    assert g.nourishment_from_session(0, completed=True, new_day=True) == 0.0
    assert g.nourishment_from_session(-5, completed=True, new_day=True) == 0.0


# ---------------------------------------------------------------------------
# Avance de fases
# ---------------------------------------------------------------------------

def test_la_planta_empieza_en_semilla():
    assert g.phase_name(0) == "semilla"
    assert g.PHASES[0] == "semilla"


def test_el_abono_se_acumula_sin_avanzar_si_no_alcanza():
    r = g.water(phase=0, nourishment=0, gained=30)
    assert r.phase == 0
    assert r.nourishment == 30
    assert r.phases_advanced == 0


def test_al_cubrir_el_costo_la_planta_avanza_de_fase():
    costo = g.cost_of(0)
    r = g.water(phase=0, nourishment=0, gained=costo)
    assert r.phase == 1
    assert r.phase_name == "brote"
    assert r.phases_advanced == 1


def test_el_sobrante_se_guarda_para_la_fase_siguiente():
    """Una sesion larga no debe desperdiciar el excedente al cruzar el umbral."""
    costo = g.cost_of(0)
    r = g.water(phase=0, nourishment=0, gained=costo + 25)
    assert r.phase == 1
    assert r.nourishment == 25


def test_una_sola_regada_puede_saltar_varias_fases():
    total = g.cost_of(0) + g.cost_of(1) + g.cost_of(2)
    r = g.water(phase=0, nourishment=0, gained=total)
    assert r.phase == 3
    assert r.phases_advanced == 3


def test_la_planta_no_pasa_de_arbol():
    r = g.water(phase=g.MAX_PHASE, nourishment=0, gained=99999)
    assert r.phase == g.MAX_PHASE
    assert r.phase_name == "arbol"
    assert r.reached_max is True
    assert r.nourishment == 0.0


def test_cada_fase_cuesta_mas_que_la_anterior():
    costos = [g.cost_of(i) for i in range(g.MAX_PHASE)]
    assert costos == sorted(costos)
    assert len(set(costos)) == len(costos)


def test_la_ultima_fase_no_tiene_costo():
    assert g.cost_of(g.MAX_PHASE) == 0


# ---------------------------------------------------------------------------
# Progreso y etiquetas
# ---------------------------------------------------------------------------

def test_el_progreso_va_de_cero_a_uno():
    costo = g.cost_of(0)
    assert g.progress_pct(0, 0) == 0.0
    assert g.progress_pct(0, costo / 2) == pytest.approx(0.5)
    assert g.progress_pct(0, costo) == 1.0
    assert g.progress_pct(0, costo * 5) == 1.0


def test_la_fase_maxima_siempre_muestra_progreso_completo():
    assert g.progress_pct(g.MAX_PHASE, 0) == 1.0


def test_las_etiquetas_estan_en_los_dos_idiomas():
    assert g.phase_label(0, "es") == "Semilla"
    assert g.phase_label(0, "en") == "Seed"
    assert g.phase_label(g.MAX_PHASE, "es") == "Arbol"


def test_las_fases_fuera_de_rango_se_acotan():
    assert g.phase_name(-3) == "semilla"
    assert g.phase_name(99) == "arbol"


# ---------------------------------------------------------------------------
# Recorrido completo
# ---------------------------------------------------------------------------

def test_llegar_a_arbol_exige_una_relacion_sostenida():
    """
    Simula sesiones diarias de 25 minutos entre dos amigos y cuenta cuantas
    hacen falta para llegar a arbol. Debe ser un numero alto para que el
    jardin premie la constancia y no un par de encuentros.
    """
    fase, abono, dias = 0, 0.0, 0

    while fase < g.MAX_PHASE and dias < 500:
        dias += 1
        ganado = g.nourishment_from_session(25, completed=True, new_day=True)
        r = g.water(fase, abono, ganado)
        fase, abono = r.phase, r.nourishment

    assert fase == g.MAX_PHASE
    assert 15 <= dias <= 60, f"Llegar a arbol tomo {dias} sesiones diarias"
