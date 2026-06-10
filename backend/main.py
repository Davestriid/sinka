import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.cache import check_redis_connection
from core.config import settings
from core.database import engine
from core.event_bus import EventBus
from core.middleware import SecurityHeadersMiddleware
from modules.gamification.api.router import router as gamification_router
from modules.gamification.api.shop_router import router as shop_router
from modules.gamification.services.gamification_service import gamification_service
from modules.identity.api.router import router as identity_router
from modules.matchmaking.api.router import router as matchmaking_router
from modules.sessions.api.router import router as sessions_router
from modules.sessions.services.session_service import session_service

# Importar modelos para que Alembic los detecte en el contexto de la app
import modules.gamification.models  # noqa: F401
import modules.matchmaking.models   # noqa: F401
import modules.sessions.models      # noqa: F401

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Routers
app.include_router(identity_router,    prefix="/api")
app.include_router(matchmaking_router, prefix="/api")
app.include_router(sessions_router,    prefix="/api")
app.include_router(gamification_router, prefix="/api")
app.include_router(shop_router,         prefix="/api")


@app.on_event("startup")
async def startup_event() -> None:
    """
    Suscribir handlers del EventBus y registrar inicio.
    Las migraciones se aplican manualmente via start_server.ps1.
    """
    # Matchmaking -> Sessions: cuando se crea un match, inicializar la sesion
    EventBus.subscribe("match.created", session_service.on_match_created)
    # Sessions -> Gamification: cuando termina una sesion, actualizar XP y racha
    EventBus.subscribe("session.completed", gamification_service.on_session_completed)

    logger.info(
        "SINKA API iniciada (v%s). EventBus configurado. "
        "Esquema de BD gestionado via \'alembic upgrade head\'.",
        settings.app_version,
    )


@app.get("/api/ping", tags=["health"])
async def ping():
    return {"ping": "pong"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": request.headers.get("origin", "*")},
    )


@app.get("/api/health", tags=["health"])
async def health_check():
    import sqlalchemy

    redis_ok = await check_redis_connection()

    db_ok = False
    try:
        async with engine.connect() as conn:
            await conn.execute(sqlalchemy.text("SELECT 1"))
        db_ok = True
    except Exception as e:
        logger.error("DB health check failed: %s", e)

    status_str = "ok" if (redis_ok and db_ok) else "degraded"
    return {
        "status": status_str,
        "services": {
            "database": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "error",
        },
        "version": settings.app_version,
    }
