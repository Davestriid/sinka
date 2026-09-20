"""
Pruebas del acuerdo para continuar dentro del SessionService.

Aqui se verifica el cableado completo: que la propuesta llegue a las dos
personas, que el voto de cada una se propague, y que la sesion solo siga
cuando ambas aceptan.

Las conexiones WebSocket se reemplazan por un doble que guarda lo enviado,
de modo que las pruebas corren sin red ni base de datos.
"""
import asyncio

import pytest

from modules.sessions.services import session_service as modulo
from modules.sessions.services.extension_service import extension_service
from modules.sessions.services.pomodoro_service import PomodoroTimer
from modules.sessions.services.session_service import SessionService, _SessionConnection

SESION = "sesion-de-prueba"
ANA, BETO = "ana", "beto"


class WebSocketFalso:
    """Guarda los mensajes en lugar de mandarlos por la red."""

    def __init__(self) -> None:
        self.enviados: list[dict] = []

    async def send_json(self, mensaje: dict) -> None:
        self.enviados.append(mensaje)

    def tipos(self) -> list[str]:
        return [m["type"] for m in self.enviados]

    def ultimo(self, tipo: str) -> dict | None:
        for mensaje in reversed(self.enviados):
            if mensaje["type"] == tipo:
                return mensaje
        return None


@pytest.fixture
def escena():
    """Un servicio con una sesion activa entre Ana y Beto."""
    servicio = SessionService()
    ws_ana, ws_beto = WebSocketFalso(), WebSocketFalso()
    servicio._sessions[SESION] = _SessionConnection(
        user_a_id=ANA, user_b_id=BETO, ws_a=ws_ana, ws_b=ws_beto,
    )
    extension_service.limpiar(SESION)
    yield servicio, ws_ana, ws_beto
    extension_service.limpiar(SESION)


# ---------------------------------------------------------------------------
# Cuando aparece la propuesta
# ---------------------------------------------------------------------------

async def test_no_se_propone_en_el_primer_encuentro(escena):
    servicio, ws_ana, ws_beto = escena
    servicio.set_encounter_count(SESION, 1)

    sigue = await servicio._ofrecer_extension(SESION, PomodoroTimer())

    assert sigue is False
    assert "EXTENSION_OFFER" not in ws_ana.tipos()
    assert "EXTENSION_OFFER" not in ws_beto.tipos()


async def test_la_propuesta_llega_a_los_dos(escena):
    servicio, ws_ana, ws_beto = escena
    servicio.set_encounter_count(SESION, 2)

    tarea = asyncio.create_task(servicio._ofrecer_extension(SESION, PomodoroTimer()))
    await asyncio.sleep(0)   # deja que la propuesta salga

    assert "EXTENSION_OFFER" in ws_ana.tipos()
    assert "EXTENSION_OFFER" in ws_beto.tipos()

    await servicio.register_extension_vote(SESION, ANA, False)
    await tarea


# ---------------------------------------------------------------------------
# Resultado de la votacion
# ---------------------------------------------------------------------------

async def test_la_sesion_sigue_si_ambos_aceptan(escena):
    servicio, ws_ana, _ = escena
    servicio.set_encounter_count(SESION, 2)
    timer = PomodoroTimer(max_rounds=1)

    tarea = asyncio.create_task(servicio._ofrecer_extension(SESION, timer))
    await asyncio.sleep(0)

    await servicio.register_extension_vote(SESION, ANA, True)
    await servicio.register_extension_vote(SESION, BETO, True)

    assert await tarea is True
    assert timer.max_rounds == 2
    assert ws_ana.ultimo("EXTENSION_RESULT")["payload"]["result"] == "aceptada"


async def test_basta_que_uno_diga_que_no(escena):
    servicio, ws_ana, _ = escena
    servicio.set_encounter_count(SESION, 2)
    timer = PomodoroTimer(max_rounds=1)

    tarea = asyncio.create_task(servicio._ofrecer_extension(SESION, timer))
    await asyncio.sleep(0)

    await servicio.register_extension_vote(SESION, ANA, True)
    await servicio.register_extension_vote(SESION, BETO, False)

    assert await tarea is False
    assert timer.max_rounds == 1   # el temporizador no se toca


async def test_mientras_falta_alguien_se_sigue_esperando(escena):
    servicio, ws_ana, _ = escena
    servicio.set_encounter_count(SESION, 2)

    tarea = asyncio.create_task(servicio._ofrecer_extension(SESION, PomodoroTimer()))
    await asyncio.sleep(0)

    await servicio.register_extension_vote(SESION, ANA, True)

    aviso = ws_ana.ultimo("EXTENSION_VOTE_UPDATE")
    assert aviso["payload"]["result"] == "esperando"
    assert aviso["payload"]["waiting_on"] == [BETO]
    assert not tarea.done()

    await servicio.register_extension_vote(SESION, BETO, False)
    await tarea


async def test_si_nadie_responde_la_sesion_cierra(escena, monkeypatch):
    servicio, ws_ana, _ = escena
    servicio.set_encounter_count(SESION, 2)
    monkeypatch.setattr(modulo, "EXTENSION_VOTE_TIMEOUT", 0.05)
    timer = PomodoroTimer(max_rounds=1)

    sigue = await servicio._ofrecer_extension(SESION, timer)

    assert sigue is False
    assert timer.max_rounds == 1
    assert ws_ana.ultimo("EXTENSION_RESULT")["payload"]["result"] == "expirada"


# ---------------------------------------------------------------------------
# Limites
# ---------------------------------------------------------------------------

async def test_no_se_propone_mas_alla_del_tope(escena):
    """Con las extensiones agotadas la sesion cierra sin preguntar."""
    servicio, ws_ana, _ = escena
    servicio.set_encounter_count(SESION, 5)
    timer = PomodoroTimer()
    timer.extensions = 2   # ya se uso el maximo

    sigue = await servicio._ofrecer_extension(SESION, timer)

    assert sigue is False
    assert "EXTENSION_OFFER" not in ws_ana.tipos()


async def test_el_voto_sin_sesion_no_revienta(escena):
    servicio, _, _ = escena
    await servicio.register_extension_vote("sesion-que-no-existe", ANA, True)
