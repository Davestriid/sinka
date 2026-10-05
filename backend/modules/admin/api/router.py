"""
Panel de administracion.

Todo bajo /api/admin y protegido por rol (ver dependencies.py):
  GET   /admin/stats                    — numeros generales            (admin+)
  GET   /admin/users                     — listado paginado, con busqueda (admin+)
  POST  /admin/users/{id}/ban            — suspender                   (admin+)
  POST  /admin/users/{id}/unban          — reactivar                   (admin+)
  PATCH /admin/users/{id}/role           — otorgar/quitar admin        (superadmin)
  GET   /admin/shop                      — catalogo completo (incl. inactivos) (admin+)
  PATCH /admin/shop/{item_id}            — precio, nombre, activo/no   (admin+)
  POST  /admin/announcements             — anuncio a todos los usuarios (admin+)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.admin.api.dependencies import require_admin, require_superadmin
from modules.admin.schemas import (
    AdminShopItemRow,
    AdminStats,
    AdminUserList,
    AdminUserRow,
    AnuncioRequest,
    CambiarRolRequest,
    EditarItemTiendaRequest,
)
from modules.admin.service import AdminService
from modules.identity.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def _service(db: AsyncSession = Depends(get_db)) -> AdminService:
    return AdminService(db)


@router.get("/stats", response_model=AdminStats)
async def stats(
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminStats:
    return await service.estadisticas()


@router.get("/users", response_model=AdminUserList)
async def listar_usuarios(
    q: str | None = Query(None, description="Busca por username o correo"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminUserList:
    return await service.listar_usuarios(q, pagina, por_pagina)


@router.post("/users/{user_id}/ban", response_model=AdminUserRow)
async def banear_usuario(
    user_id: str,
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminUserRow:
    return await service.banear(user_id, banear=True)


@router.post("/users/{user_id}/unban", response_model=AdminUserRow)
async def reactivar_usuario(
    user_id: str,
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminUserRow:
    return await service.banear(user_id, banear=False)


@router.patch("/users/{user_id}/role", response_model=AdminUserRow)
async def cambiar_rol(
    user_id: str,
    body: CambiarRolRequest,
    quien_pide: UserResponse = Depends(require_superadmin),
    service: AdminService = Depends(_service),
) -> AdminUserRow:
    return await service.cambiar_rol(user_id, body.role, quien_pide.id)


@router.get("/shop", response_model=list[AdminShopItemRow])
async def listar_tienda(
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> list[AdminShopItemRow]:
    return await service.listar_items_tienda()


@router.patch("/shop/{item_id}", response_model=AdminShopItemRow)
async def editar_item_tienda(
    item_id: str,
    body: EditarItemTiendaRequest,
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminShopItemRow:
    return await service.editar_item_tienda(item_id, body.model_dump(exclude_unset=True))


@router.post("/announcements")
async def enviar_anuncio(
    body: AnuncioRequest,
    _admin: UserResponse = Depends(require_admin),
) -> dict:
    # TODO: cuando exista un canal de notificaciones push/broadcast real,
    # conectarlo aca. Por ahora queda como placeholder de la ruta.
    return {"ok": True, "titulo": body.titulo}
