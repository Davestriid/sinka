"""
Votacion para extender la sesion.

A partir del segundo encuentro con la misma persona, la pantalla final ofrece
seguir con otro bloque de trabajo. Los dos tienen que aceptar. Si uno declina,
la sesion termina con normalidad y sin penalizacion para nadie.

La regla del segundo encuentro viene de la idea de que extender es un gesto de
confianza: tiene sentido proponerlo a quien ya conoces, no a alguien con quien
acabas de coincidir por primera vez.
"""
import logging
from dataclasses import dataclass, field
from typing import Final

logger = logging.getLogger(__name__)

# A partir de cuantos encuentros se ofrece extender
MIN_ENCUENTROS_PARA_OFRECER: Final[int] = 2

# Cuanto dura el bloque extra
MINUTOS_EXTENSION: Final[int] = 25

# Cuantas veces se puede extender una misma sesion, para que no sea infinita
MAX_EXTENSIONES: Final[int] = 2


@dataclass
class VoteState:
    """Votos de una sesion concreta."""

    session_id: str
    votos: dict[str, bool] = field(default_factory=dict)
    extensiones_usadas: int = 0

    def votar(self, user_id: str, acepta: bool) -> None:
        self.votos[user_id] = acepta

    def resultado(self, participantes: list[str]) -> str:
        """
        'esperando' si falta alguien por votar,
        'aceptada'  si todos dijeron que si,
        'rechazada' si alguno dijo que no.
        """
        if any(v is False for v in self.votos.values()):
            return "rechazada"
        if all(uid in self.votos for uid in participantes):
            return "aceptada"
        return "esperando"

    def faltan_por_votar(self, participantes: list[str]) -> list[str]:
        return [uid for uid in participantes if uid not in self.votos]


def se_puede_ofrecer(encuentros_previos: int, extensiones_usadas: int) -> bool:
    """
    Si corresponde mostrar la propuesta de extender.

    encuentros_previos incluye la sesion que acaba de terminar.
    """
    if encuentros_previos < MIN_ENCUENTROS_PARA_OFRECER:
        return False
    return extensiones_usadas < MAX_EXTENSIONES


class ExtensionService:
    """Guarda los votos en memoria: son efimeros y mueren con la sesion."""

    def __init__(self) -> None:
        self._estados: dict[str, VoteState] = {}

    def iniciar(self, session_id: str, extensiones_usadas: int = 0) -> VoteState:
        estado = VoteState(session_id=session_id, extensiones_usadas=extensiones_usadas)
        self._estados[session_id] = estado
        return estado

    def obtener(self, session_id: str) -> VoteState | None:
        return self._estados.get(session_id)

    def votar(
        self,
        session_id: str,
        user_id: str,
        acepta: bool,
        participantes: list[str],
    ) -> dict:
        """
        Registra el voto y devuelve el estado de la votacion.
        """
        estado = self._estados.get(session_id)
        if estado is None:
            estado = self.iniciar(session_id)

        estado.votar(user_id, acepta)
        resultado = estado.resultado(participantes)

        if resultado == "aceptada":
            estado.extensiones_usadas += 1
            estado.votos.clear()  # se limpia para una posible siguiente ronda
            logger.info("Extension: sesion %s extendida por acuerdo de ambos", session_id)

        return {
            "result":            resultado,
            "votes":             dict(estado.votos),
            "waiting_on":        estado.faltan_por_votar(participantes),
            "extensions_used":   estado.extensiones_usadas,
            "extensions_left":   max(0, MAX_EXTENSIONES - estado.extensiones_usadas),
            "extension_minutes": MINUTOS_EXTENSION,
        }

    def limpiar(self, session_id: str) -> None:
        self._estados.pop(session_id, None)


extension_service = ExtensionService()
