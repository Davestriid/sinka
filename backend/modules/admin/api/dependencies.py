"""
Guardas de rol para el panel de administracion.

Tres niveles: "usuario" (nadie entra con esto), "admin" (puede moderar) y
"superadmin" (ademas puede otorgar o quitar el rol admin a otras personas y
tocar cosas sensibles como los precios de la tienda). Un superadmin cumple
tambien los requisitos de admin.
"""
from fastapi import Depends, HTTPException, status

from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse


async def require_admin(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administrador.",
        )
    return current_user


async def require_superadmin(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta accion requiere el rol superadmin.",
        )
    return current_user
