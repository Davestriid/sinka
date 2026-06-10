"""
Middleware de seguridad para SINKA.

SecurityHeadersMiddleware:
  Añade cabeceras HTTP de seguridad recomendadas en cada respuesta.
  No requiere dependencias externas.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Inyecta cabeceras de seguridad en todas las respuestas HTTP.

    Cabeceras incluidas:
    - X-Content-Type-Options: nosniff         — Evita MIME-type sniffing
    - X-Frame-Options: DENY                   — Previene clickjacking
    - X-XSS-Protection: 1; mode=block         — Filtro XSS legacy (IE/Edge)
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: camera=(), microphone=(), geolocation=()
    - Content-Security-Policy: política base permisiva (ajustar según deploy)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        # CSP base: permite fetch al mismo origen + WebSocket al mismo origen.
        # Ajustar en producción para incluir el dominio de Vercel / Render.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "connect-src 'self' wss: ws: https:; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:;"
        )

        return response
