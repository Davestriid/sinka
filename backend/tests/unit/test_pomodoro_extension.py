"""
Pruebas de la extension del temporizador Pomodoro.

Cuando la pareja acuerda seguir, el temporizador no se reinicia: suma rondas y
retoma la sesion donde estaba. Esa distincion importa porque el jardin y las
recompensas dependen del avance acumulado de la sesion.
"""
from modules.sessions.services.pomodoro_service import (
    BREAK_SECONDS,
    FOCUS_SECONDS,
    MAX_ROUNDS,
    PomodoroTimer,
)


def completar_todo(timer: PomodoroTimer) -> dict:
    """Avanza el temporizador hasta que se agotan todas las rondas."""
    estado = timer.snapshot()
    limite = (FOCUS_SECONDS + BREAK_SECONDS) * (timer.max_rounds + 1)
    for _ in range(limite):
        estado = timer.tick()
        if estado["all_completed"]:
            break
    return estado


# ---------------------------------------------------------------------------
# Estado inicial
# ---------------------------------------------------------------------------

def test_arranca_con_el_tope_por_defecto():
    timer = PomodoroTimer()
    assert timer.max_rounds == MAX_ROUNDS
    assert timer.extensions == 0


def test_el_tope_se_puede_fijar_al_crear():
    timer = PomodoroTimer(max_rounds=1)
    assert timer.snapshot()["max_rounds"] == 1


# ---------------------------------------------------------------------------
# Extension
# ---------------------------------------------------------------------------

def test_extender_suma_una_ronda():
    timer = PomodoroTimer()
    estado = timer.extend()
    assert estado["max_rounds"] == MAX_ROUNDS + 1
    assert estado["extensions"] == 1


def test_extender_reabre_un_temporizador_terminado():
    timer = PomodoroTimer(max_rounds=1)
    assert completar_todo(timer)["all_completed"] is True

    estado = timer.extend()

    assert estado["all_completed"] is False
    assert estado["phase"] == "focus"
    assert estado["elapsed"] == 0


def test_la_sesion_sigue_avanzando_despues_de_extender():
    timer = PomodoroTimer(max_rounds=1)
    completar_todo(timer)
    timer.extend()

    estado = timer.tick()

    assert estado["all_completed"] is False
    assert estado["remaining"] == FOCUS_SECONDS - 1


def test_extender_conserva_la_ronda_alcanzada():
    """Al continuar no se vuelve a la ronda uno: la sesion es la misma."""
    timer = PomodoroTimer(max_rounds=2)
    completar_todo(timer)
    ronda_final = timer.round

    timer.extend()

    assert timer.round == ronda_final


def test_dos_extensiones_se_acumulan():
    timer = PomodoroTimer(max_rounds=1)
    timer.extend()
    timer.extend()
    assert timer.max_rounds == 3
    assert timer.extensions == 2


def test_sin_extender_el_temporizador_no_revive():
    timer = PomodoroTimer(max_rounds=1)
    completar_todo(timer)

    estado = timer.tick()

    assert estado["all_completed"] is True
