"""
Presencia en tiempo real.

Cuenta cuanta gente esta concentrada en este momento. Es el dato que la
pantalla de inicio muestra como "38 personas concentradas ahora", y cumple una
funcion concreta: quien entra y ve que hay gente trabajando se anima a
quedarse; quien ve un cero se va.

Se apoya en Redis con claves que caducan solas. Cada usuario activo escribe una
marca con vencimiento corto y la renueva mientras siga en sesion. Si el
navegador se cierra de golpe, la marca vence y el conteo se corrige sin que
nadie tenga que limpiarla.
"""
import logging

from core.cache import redis_client

logger = logging.getLogger(__name__)

CLAVE_ACTIVO = "presence:focusing:{user_id}"
PATRON_ACTIVOS = "presence:focusing:*"

# Cuanto vive la marca sin renovarse. Debe superar el intervalo de renovacion
# del cliente para que una demora de red no borre a alguien que sigue ahi.
TTL_SEGUNDOS = 90


class PresenceService:
    async def marcar_activo(self, user_id: str, topic: str | None = None) -> None:
        """Registra o renueva la marca de que este usuario esta concentrado."""
        try:
            await redis_client.setex(
                CLAVE_ACTIVO.format(user_id=user_id),
                TTL_SEGUNDOS,
                topic or "",
            )
        except Exception:
            logger.exception("Presencia: no se pudo marcar activo a %s", user_id)

    async def marcar_inactivo(self, user_id: str) -> None:
        try:
            await redis_client.delete(CLAVE_ACTIVO.format(user_id=user_id))
        except Exception:
            logger.exception("Presencia: no se pudo marcar inactivo a %s", user_id)

    async def contar(self) -> int:
        """
        Cuanta gente esta concentrada ahora.

        Un fallo de Redis no debe romper la pantalla de inicio, asi que ante un
        error se devuelve cero y se registra el problema.
        """
        try:
            total = 0
            async for _ in redis_client.scan_iter(match=PATRON_ACTIVOS, count=500):
                total += 1
            return total
        except Exception:
            logger.exception("Presencia: no se pudo contar a los activos")
            return 0

    async def contar_por_categoria(self) -> dict[str, int]:
        """Desglose por categoria, para mostrar donde hay mas movimiento."""
        try:
            conteo: dict[str, int] = {}
            async for clave in redis_client.scan_iter(match=PATRON_ACTIVOS, count=500):
                topic = await redis_client.get(clave)
                if topic:
                    nombre = topic.decode() if isinstance(topic, bytes) else str(topic)
                    if nombre:
                        conteo[nombre] = conteo.get(nombre, 0) + 1
            return conteo
        except Exception:
            logger.exception("Presencia: no se pudo desglosar por categoria")
            return {}


presence_service = PresenceService()
