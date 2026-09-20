"""
Pruebas de la seleccion de parejas por afinidad de categoria.

Se prueba _buscar_parejas() de forma aislada porque es la funcion que decide
quien trabaja con quien. No toca Redis ni WebSockets, asi que se puede
verificar con datos en memoria.
"""
import time

import pytest

from modules.matchmaking.services.matchmaking_service import (
    AFFINITY_WINDOW_SECONDS,
    MatchmakingService,
    _WaitEntry,
)


def _entry(topic: str, esperando_hace: float = 0.0) -> _WaitEntry:
    """Crea una entrada de cola falsa que lleva N segundos esperando."""
    e = _WaitEntry(websocket=None, username="u", task_info={}, topic=topic)
    e.joined_at = time.monotonic() - esperando_hace
    return e


@pytest.fixture
def service() -> MatchmakingService:
    return MatchmakingService()


def test_dos_de_la_misma_categoria_se_emparejan(service):
    service._waiting = {
        "ana":  _entry("software"),
        "beto": _entry("software"),
    }
    parejas = service._buscar_parejas()

    assert len(parejas) == 1
    a, b, por_afinidad = parejas[0]
    assert {a, b} == {"ana", "beto"}
    assert por_afinidad is True


def test_categorias_distintas_no_se_emparejan_al_inicio(service):
    service._waiting = {
        "ana":  _entry("software"),
        "beto": _entry("design"),
    }
    assert service._buscar_parejas() == []


def test_categorias_distintas_se_emparejan_tras_la_ventana(service):
    espera = AFFINITY_WINDOW_SECONDS + 1
    service._waiting = {
        "ana":  _entry("software", esperando_hace=espera),
        "beto": _entry("design",   esperando_hace=espera),
    }
    parejas = service._buscar_parejas()

    assert len(parejas) == 1
    _, _, por_afinidad = parejas[0]
    assert por_afinidad is False


def test_la_afinidad_tiene_prioridad_sobre_el_tiempo_de_espera(service):
    """Quien lleva rato esperando cede el turno si aparece alguien de su categoria."""
    service._waiting = {
        "viejo":  _entry("design",   esperando_hace=AFFINITY_WINDOW_SECONDS + 10),
        "ana":    _entry("software"),
        "beto":   _entry("software"),
    }
    parejas = service._buscar_parejas()

    assert len(parejas) == 1
    a, b, por_afinidad = parejas[0]
    assert {a, b} == {"ana", "beto"}
    assert por_afinidad is True
    assert "viejo" not in (a, b)


def test_el_que_mas_espero_se_empareja_primero(service):
    service._waiting = {
        "nuevo":    _entry("software", esperando_hace=1),
        "mediano":  _entry("software", esperando_hace=20),
        "antiguo":  _entry("software", esperando_hace=40),
    }
    parejas = service._buscar_parejas()

    assert len(parejas) == 1
    a, b, _ = parejas[0]
    assert {a, b} == {"antiguo", "mediano"}


def test_un_solo_usuario_no_forma_pareja(service):
    service._waiting = {"solo": _entry("software", esperando_hace=999)}
    assert service._buscar_parejas() == []


def test_nadie_queda_emparejado_dos_veces(service):
    service._waiting = {
        f"u{i}": _entry("software", esperando_hace=AFFINITY_WINDOW_SECONDS + 5)
        for i in range(5)
    }
    parejas = service._buscar_parejas()

    usados = [uid for a, b, _ in parejas for uid in (a, b)]
    assert len(usados) == len(set(usados))
    assert len(parejas) == 2  # 5 usuarios dan 2 parejas y uno queda esperando


def test_conteo_por_categoria(service):
    service._waiting = {
        "a": _entry("software"),
        "b": _entry("software"),
        "c": _entry("design"),
    }
    assert service.queue_by_topic() == {"software": 2, "design": 1}
