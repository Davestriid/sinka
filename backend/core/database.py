from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import settings

engine = create_async_engine(
    settings.database_url,
    # El "session pooler" de Supabase (el que usamos) solo admite 15
    # conexiones simultaneas EN TOTAL, compartidas por toda la aplicacion.
    # Con pool_size=10 y max_overflow=20 el propio backend podia pedir hasta
    # 30 el solo: bastaban un par de sesiones concurrentes para agotar el
    # limite y que el resto de la gente viera "No se pudo conectar al
    # servidor" aunque el servidor estuviera perfectamente sano. Se deja
    # margen debajo del limite real para que la app nunca se ahogue a si
    # misma, y pool_recycle evita quedarse con conexiones que Supabase ya
    # cerro por inactividad.
    pool_size=8,
    max_overflow=4,
    pool_timeout=10,
    pool_recycle=300,
    echo=settings.app_env == "development",
    connect_args={"ssl": "require", "statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
