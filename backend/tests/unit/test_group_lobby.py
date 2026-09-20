"""
Pruebas de la sala de espera de los grupos.

Se prueba _Lobby.puede_iniciar() de forma aislada porque ahi vive la regla de
negocio: cuando un grupo esta listo para arrancar y cuando la pantalla
compartida es obligatoria.
"""
import pytest

from modules.groups.models import Group, generar_codigo
from modules.groups.services.lobby_service import (
    MIN_PARA_INICIAR,
    _Lobby,
    _Presencia,
)


def _presencia(nombre: str, listo: bool = False, pantalla: bool = False) -> _Presencia:
    return _Presencia(
        websocket=None,
        username=nombre,
        ready=listo,
        sharing_screen=pantalla,
    )


def _lobby(requiere_pantalla: bool = False, **presentes) -> _Lobby:
    lobby = _Lobby(
        group_id="g1",
        requires_screen_share=requiere_pantalla,
        owner_id="ana",
    )
    lobby.presentes = dict(presentes)
    return lobby


# ---------------------------------------------------------------------------
# Cuantos hacen falta
# ---------------------------------------------------------------------------

def test_una_sola_persona_no_puede_iniciar():
    lobby = _lobby(ana=_presencia("ana", listo=True))
    puede, motivo = lobby.puede_iniciar()

    assert puede is False
    assert str(MIN_PARA_INICIAR) in motivo


def test_dos_personas_listas_pueden_iniciar():
    lobby = _lobby(
        ana=_presencia("ana", listo=True),
        beto=_presencia("beto", listo=True),
    )
    puede, _ = lobby.puede_iniciar()
    assert puede is True


def test_estar_presente_no_es_lo_mismo_que_estar_listo():
    """Quien no marco listo no cuenta para arrancar."""
    lobby = _lobby(
        ana=_presencia("ana", listo=True),
        beto=_presencia("beto", listo=False),
        carla=_presencia("carla", listo=False),
    )
    puede, _ = lobby.puede_iniciar()
    assert puede is False


# ---------------------------------------------------------------------------
# Pantalla compartida obligatoria
# ---------------------------------------------------------------------------

def test_sin_la_exigencia_la_pantalla_no_hace_falta():
    lobby = _lobby(
        requiere_pantalla=False,
        ana=_presencia("ana", listo=True, pantalla=False),
        beto=_presencia("beto", listo=True, pantalla=False),
    )
    puede, _ = lobby.puede_iniciar()
    assert puede is True


def test_con_desconocidos_la_pantalla_es_obligatoria():
    lobby = _lobby(
        requiere_pantalla=True,
        ana=_presencia("ana", listo=True, pantalla=True),
        beto=_presencia("beto", listo=True, pantalla=False),
    )
    puede, motivo = lobby.puede_iniciar()

    assert puede is False
    assert "beto" in motivo


def test_el_aviso_nombra_a_quien_falta():
    lobby = _lobby(
        requiere_pantalla=True,
        ana=_presencia("ana", listo=True, pantalla=True),
        beto=_presencia("beto", listo=True, pantalla=False),
        carla=_presencia("carla", listo=True, pantalla=False),
    )
    _, motivo = lobby.puede_iniciar()

    assert "beto" in motivo
    assert "carla" in motivo
    assert "ana" not in motivo


def test_con_todos_compartiendo_pantalla_se_puede_iniciar():
    lobby = _lobby(
        requiere_pantalla=True,
        ana=_presencia("ana", listo=True, pantalla=True),
        beto=_presencia("beto", listo=True, pantalla=True),
    )
    puede, _ = lobby.puede_iniciar()
    assert puede is True


def test_quien_no_esta_listo_no_bloquea_por_no_compartir_pantalla():
    """
    Solo se le exige pantalla a quien va a participar. Quien esta mirando sin
    marcar listo no debe impedir que los demas arranquen.
    """
    lobby = _lobby(
        requiere_pantalla=True,
        ana=_presencia("ana", listo=True, pantalla=True),
        beto=_presencia("beto", listo=True, pantalla=True),
        mirando=_presencia("mirando", listo=False, pantalla=False),
    )
    puede, _ = lobby.puede_iniciar()
    assert puede is True


def test_sala_vacia_no_puede_iniciar():
    assert _lobby().puede_iniciar()[0] is False


# ---------------------------------------------------------------------------
# Codigo de invitacion
# ---------------------------------------------------------------------------

def test_el_codigo_evita_caracteres_confusos():
    """No debe traer O, 0, I, 1 ni L porque el codigo se dicta en voz alta."""
    for _ in range(200):
        codigo = generar_codigo()
        assert not (set(codigo) & set("O0I1L"))


def test_el_codigo_tiene_la_longitud_esperada():
    assert len(generar_codigo()) == 8


def test_los_codigos_no_se_repiten():
    codigos = {generar_codigo() for _ in range(500)}
    assert len(codigos) == 500


# ---------------------------------------------------------------------------
# Regla de la pantalla en el modelo
# ---------------------------------------------------------------------------

def test_un_grupo_abierto_a_desconocidos_exige_pantalla():
    grupo = Group(name="Dev", topic="software", owner_id="ana", open_to_strangers=True)
    assert grupo.requires_screen_share is True


def test_un_grupo_cerrado_no_exige_pantalla():
    grupo = Group(name="Amigos", topic="software", owner_id="ana", open_to_strangers=False)
    assert grupo.requires_screen_share is False
