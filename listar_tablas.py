# -*- coding: utf-8 -*-
"""
Lista las tablas de la base de datos y cuantas filas tiene cada una.

Se ejecuta despues de las migraciones para confirmar que quedaron creadas y
para ver de un vistazo si hay datos reales. Solo lee: no modifica nada.
"""
import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).parent / "backend"
sys.path.insert(0, str(BACKEND))

try:
    import asyncpg
    from core.config import settings
except ImportError as e:
    print(f"No se pudo importar lo necesario: {e}")
    raise SystemExit(1)

ESPERADAS = [
    "users", "user_sessions", "matches", "focus_sessions", "user_stats",
    "shop_items", "user_inventory", "friendships", "garden_plants",
    "friend_request_quotas", "groups", "group_members", "appointments",
    "appointment_quotas", "session_penalties",
]


async def main() -> None:
    # asyncpg no entiende el prefijo de SQLAlchemy, hay que quitarlo
    dsn = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    try:
        con = await asyncio.wait_for(
            asyncpg.connect(dsn, statement_cache_size=0), timeout=30
        )
    except Exception as e:
        print(f"No se pudo conectar: {type(e).__name__}: {e}")
        raise SystemExit(1)

    filas = await con.fetch(
        "select tablename from pg_tables where schemaname='public' order by 1"
    )
    existentes = [f["tablename"] for f in filas]

    print(f"{'TABLA':26} {'FILAS':>8}   ESTADO")
    print("-" * 52)
    for tabla in ESPERADAS:
        if tabla in existentes:
            n = await con.fetchval(f'select count(*) from "{tabla}"')
            print(f"{tabla:26} {n:>8}   ok")
        else:
            print(f"{tabla:26} {'-':>8}   FALTA")

    extra = sorted(set(existentes) - set(ESPERADAS) - {"alembic_version"})
    if extra:
        print(f"\nOtras tablas presentes: {', '.join(extra)}")

    version = await con.fetchval("select version_num from alembic_version")
    print(f"\nVersion de Alembic registrada: {version}")

    await con.close()


if __name__ == "__main__":
    asyncio.run(main())
