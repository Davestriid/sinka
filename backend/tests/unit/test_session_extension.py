"""
Pruebas de la votacion para extender la sesion.

Los dos tienen que aceptar. Si uno declina, la sesion termina sin penalizacion.
"""
import pytest

from modules.sessions.services.extension_service import (
    MAX_EXTENSIONES,
    MIN_ENCUENTROS_PARA_OFRECER,
    ExtensionService,
    VoteState,
    se_puede_ofrecer,
)

PARTICIPANTES = ["ana", "beto"]


@pytest.fixture
def service() -> ExtensionService:
    return ExtensionService()


# ---------------------------------------------------------------------------
# Cuando se ofrece
# ---------------------------------------------------------------------------

def test_no_se_ofrece_en_el_primer_encuentro():
    assert se_puede_ofrecer(encuentros_previos=1, extensiones_usadas=0) is False


def test_se_ofrece_desde_el_segundo_encuentro():
    assert se_puede_ofrecer(MIN_ENCUENTROS_PARA_OFRECER, extensiones_usadas=0) is True


def test_deja_de_ofrecerse_al_agotar_las_extensiones():
    assert se_puede_ofrecer(encuentros_previos=10, extensiones_usadas=MAX_EXTENSIONES) is False


# ---------------------------------------------------------------------------
# Votacion
# ---------------------------------------------------------------------------

def test_con_un_solo_voto_se_sigue_esperando(service):
    r = service.votar("s1", "ana", True, PARTICIPANTES)

    assert r["result"] == "esperando"
    assert r["waiting_on"] == ["beto"]


def test_con_ambos_aceptando_la_sesion_se_extiende(service):
    service.votar("s1", "ana", True, PARTICIPANTES)
    r = service.votar("s1", "beto", True, PARTICIPANTES)

    assert r["result"] == "aceptada"
    assert r["extensions_used"] == 1


def test_basta_un_no_para_terminar(service):
    r = service.votar("s1", "ana", False, PARTICIPANTES)

    assert r["result"] == "rechazada"


def test_el_no_manda_aunque_el_otro_diga_si(service):
    service.votar("s1", "ana", True, PARTICIPANTES)
    r = service.votar("s1", "beto", False, PARTICIPANTES)

    assert r["result"] == "rechazada"
    assert r["extensions_used"] == 0


def test_tras_aceptar_los_votos_se_limpian_para_la_siguiente_ronda(service):
    service.votar("s1", "ana", True, PARTICIPANTES)
    r = service.votar("s1", "beto", True, PARTICIPANTES)

    assert r["votes"] == {}
    assert r["extensions_left"] == MAX_EXTENSIONES - 1


def test_no_se_puede_extender_indefinidamente(service):
    for _ in range(MAX_EXTENSIONES):
        service.votar("s1", "ana", True, PARTICIPANTES)
        service.votar("s1", "beto", True, PARTICIPANTES)

    estado = service.obtener("s1")
    assert estado is not None
    assert estado.extensiones_usadas == MAX_EXTENSIONES
    assert se_puede_ofrecer(99, estado.extensiones_usadas) is False


def test_cada_sesion_lleva_su_propia_votacion(service):
    service.votar("s1", "ana", True, PARTICIPANTES)
    r2 = service.votar("s2", "ana", True, PARTICIPANTES)

    assert r2["result"] == "esperando"
    assert service.obtener("s1") is not service.obtener("s2")


def test_cambiar_el_voto_reemplaza_al_anterior(service):
    service.votar("s1", "ana", True, PARTICIPANTES)
    r = service.votar("s1", "ana", False, PARTICIPANTES)

    assert r["result"] == "rechazada"


def test_limpiar_borra_el_estado(service):
    service.votar("s1", "ana", True, PARTICIPANTES)
    service.limpiar("s1")

    assert service.obtener("s1") is None


# ---------------------------------------------------------------------------
# Estado de la votacion
# ---------------------------------------------------------------------------

def test_faltan_por_votar_lista_a_quien_no_respondio():
    estado = VoteState(session_id="s1")
    estado.votar("ana", True)

    assert estado.faltan_por_votar(PARTICIPANTES) == ["beto"]


def test_sin_votos_faltan_todos():
    estado = VoteState(session_id="s1")
    assert estado.faltan_por_votar(PARTICIPANTES) == PARTICIPANTES
