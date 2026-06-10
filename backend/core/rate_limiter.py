"""
Rate limiter en memoria basado en ventana deslizante.

Uso como dependencia FastAPI:
    from core.rate_limiter import rate_limit

    @router.post("/login")
    async def login(..., _: None = Depends(rate_limit(5, 60))):
        ...

Parámetros:
    max_calls  — Número máximo de llamadas permitidas
    period_sec — Tamaño de la ventana en segundos

Notas de producción:
    - Este limiter vive en RAM del proceso; en entornos multi-proceso o multi-replica
      usar Redis como backend (ej. slowapi con RedisStorage).
    - Suficiente para demos monoproceso (Render Free Tier = 1 instancia).
"""
import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import HTTPException, Request, status


class _SlidingWindowLimiter:
    """Sliding-window rate limiter con almacenamiento en deque."""

    def __init__(self) -> None:
        # IP → deque de timestamps
        self._windows: dict[str, deque] = defaultdict(deque)

    def is_allowed(self, key: str, max_calls: int, period_sec: int) -> bool:
        now = time.monotonic()
        window = self._windows[key]

        # Eliminar registros fuera de la ventana
        cutoff = now - period_sec
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= max_calls:
            return False

        window.append(now)
        return True


_limiter = _SlidingWindowLimiter()


def rate_limit(max_calls: int = 5, period_sec: int = 60) -> Callable:
    """
    Devuelve una dependencia FastAPI que lanza 429 si se supera el límite.

    Ejemplo:
        @router.post("/login")
        async def login(_: None = Depends(rate_limit(5, 60))):
            ...
    """
    async def _dependency(request: Request) -> None:
        # Clave: IP del cliente. X-Forwarded-For para proxies/Render.
        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )
        key = f"{request.url.path}:{client_ip}"

        if not _limiter.is_allowed(key, max_calls, period_sec):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Demasiadas solicitudes. Máximo {max_calls} por {period_sec}s.",
                headers={"Retry-After": str(period_sec)},
            )

    return _dependency
