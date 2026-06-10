import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from core.config import settings
from core.database import Base

# Importar todos los modelos para que Alembic los detecte
import modules.identity.models     # noqa: F401
import modules.matchmaking.models  # noqa: F401
import modules.sessions.models     # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(settings.database_url, connect_args={"ssl": "require", "statement_cache_size": 0})
    async with engine.begin() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    try:
        # Si hay un event loop corriendo (e.g., llamado desde el startup de FastAPI),
        # ejecutar en un thread separado con su propio event loop para evitar
        # "This event loop is already running" / coroutine never awaited.
        asyncio.get_running_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(asyncio.run, run_async_migrations())
            future.result()
    except RuntimeError:
        # No hay event loop activo — podemos usar asyncio.run() directamente.
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
