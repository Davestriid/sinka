"""
Pruebas de que el emparejamiento respeta los bloqueos.

Si alguien bloquea a otra persona, el sistema no debe volver a ponerlos en la
misma sesion. El bloqueo es reciproco: basta con que una de las dos lo pida.
"""
import time

import pytest

from modules.matchmaking.services.matchmaking_service import (
    AFFINITY_WINDOW_SECONDS,
    MatchmakingService,
    _WaitEntry,
)


def _entry(topic: str, bloqueados: set[str] | None = None, esperando_hace: float = 0.0):
    e = _WaitEntry(
        websocket=None,
        username="u",
        task_info={},
        topic=topic,
        blocked=frozenset(bloqueados or set()),
    )
    e.joined_at = time.monotonic() - esperando_hace
    return e


@pytest.fixture
def service() -> MatchmakingService:
    return MatchmakingService()


def test_no_empareja_a_quien_bloqueo(service):
    service._waiting = {
        "ana":  _entry("software", bloqueados={"beto"}),
        "beto": _entry("software"),
    }
    assert service._buscar_parejas() == []


def test_el_bloqueo_funciona_en_ambos_sentidos(service):
    """Da igual quien de los dos haya pedido el bloqueo."""
    service._waiting = {
        "ana":  _entry("software"),
        "beto": _entry("software", bloqueados={"ana"}),
    }
    assert service._buscar_parejas() == []


def test_busca_otro_companero_en_vez_de_descartar_la_ronda(service):
    """Si el primero de la fila no es compatible, se prueba con el siguiente."""
    service._waiting = {
        "ana":   _entry("software", bloqueados={"beto"}, esperando_hace=30),
        "beto":  _entry("software", esperando_hace=20),
        "carla": _entry("software", esperando_hace=10),
    }
    parejas = service._buscar_parejas()

    assert len(parejas) == 1
    a, b, _ = parejas[0]
    assert {a, b} == {"ana", "carla"}


def test_el_bloqueo_tambien_aplica_en_la_cola_general(service):
    espera = AFFINITY_WINDOW_SECONDS + 5
    service._waiting = {
        "ana":  _entry("software", bloqueados={"beto"}, esperando_hace=espera),
        "beto": _entry("design", esperando_hace=espera),
    }
    assert service._buscar_parejas() == []


def test_sin_bloqueos_todo_funciona_igual(service):
    service._waiting = {
        "ana":  _entry("software"),
        "beto": _entry("software"),
    }
    parejas = service._buscar_parejas()
    assert len(parejas) == 1
