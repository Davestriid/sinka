"""
Uso unico: convertir a alguien en superadmin desde la terminal.

No hay otra forma de crear el PRIMER superadmin: nadie empieza con ese rol,
y el panel solo deja que un superadmin asigne roles a otra gente. Para los
siguientes admins, usar el panel (/admin) en vez de este script.

Ejecutar desde backend/, con el entorno virtual activo:
    python -m scripts.make_superadmin correo@ejemplo.com
"""
import asyncio
import sys

from sqlalchemy import select

from core.database import AsyncSessionLocal
from modules.identity.models import User


async def main(email: str) -> None:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user:
            print(f"No existe ningun usuario con el correo {email}.")
            return
        user.role = "superadmin"
        await db.commit()
        print(f"Listo: {user.username} ({email}) ahora es superadmin.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python -m scripts.make_superadmin correo@ejemplo.com")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
