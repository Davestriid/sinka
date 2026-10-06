"""
Panel de administracion.

Todo bajo /api/admin y protegido por rol (ver dependencies.py):
  GET   /admin/stats                    — numeros generales            (admin+)
  GET   /admin/users                     — listado paginado, con busqueda/filtros (admin+)
  POST  /admin/users/{id}/ban            — suspender                   (admin+)
  POST  /admin/users/{id}/unban          — reactivar                   (admin+)
  POST  /admin/users/ban-lote            — suspender/reactivar varios a la vez (admin+)
  PATCH /admin/users/{id}/role           — otorgar/quitar admin        (superadmin)
  GET   /admin/shop                      — catalogo completo (incl. inactivos) (admin+)
  PATCH /admin/shop/{item_id}            — precio, nombre, activo/no   (superadmin)
  GET   /admin/revenue                   — ingresos reales y compras   (superadmin)
  GET   /admin/reports                   — buzon: reportes y feedback  (admin+)
  PATCH /admin/reports/{id}              — marcar revisado/descartado  (admin+)
  POST  /admin/announcements             — enviar anuncio (banner)     (admin+)
  GET   /admin/announcements             — historial de anuncios       (admin+)
  PATCH /admin/announcements/{id}/desactivar — ocultar el banner       (admin+)
  GET   /admin/settings                  — parametros configurables    (admin+)
  POST  /admin/settings                  — crear parametro nuevo       (superadmin)
  PATCH /admin/settings/{id}             — cambiar el valor             (superadmin)
  GET   /admin/audit                     — bitacora de acciones admin  (superadmin)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.admin.api.dependencies import require_admin, require_superadmin
from modules.admin.schemas import (
    ActualizarParametroRequest,
    AdminAnnouncementRow,
    AdminAuditRow,
    AdminReportRow,
    AdminRevenue,
    AdminSettingRow,
    AdminShopItemRow,
    AdminStats,
    AdminUserList,
    AdminUserRow,
    AnuncioRequest,
    CambiarRolRequest,
    CrearParametroRequest,
    EditarItemTiendaRequest,
    ResolverReporteRequest,
)
from modules.admin.service import AdminService
from modules.identity.schemas.auth import UserResponse
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])


def _service(db: AsyncSession = Depends(get_db)) -> AdminService:
    return AdminService(db)


class BanLoteRequest(BaseModel):
    user_ids: list[str]
    banear: bool


@router.get("/stats", response_model=AdminStats)
async def stats(
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminStats:
    return await service.estadisticas()


@router.get("/users", response_model=AdminUserList)
async def listar_usuarios(
    q: str | None = Query(None, description="Busca por username o correo"),
    role: str | None = Query(None, description="usuario | admin | superadmin"),
    banned: bool | None = Query(None, description="true = solo suspendidos, false = solo activos"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminUserList:
    return await service.listar_usuarios(q, pagina, por_pagina, role, banned)


@router.post("/users/{user_id}/ban", response_model=AdminUserRow)
async def banear_usuario(
    user_id: str,
    admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminUserRow:
    return await service.banear(user_id, banear=True, admin_id=admin.id)


@router.post("/users/{user_id}/unban", response_model=AdminUserRow)
async def reactivar_usuario(
    user_id: str,
    admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminUserRow:
    return await service.banear(user_id, banear=False, admin_id=admin.id)


@router.post("/users/ban-lote", response_model=list[AdminUserRow])
async def banear_lote(
    body: BanLoteRequest,
    admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> list[AdminUserRow]:
    return await service.banear_lote(body.user_ids, body.banear, admin.id)


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
    # Solo superadmin: cambiar precios toca directamente los ingresos,
    # a diferencia de solo mirar el catalogo (GET /shop arriba, nivel admin).
    admin: UserResponse = Depends(require_superadmin),
    service: AdminService = Depends(_service),
) -> AdminShopItemRow:
    return await service.editar_item_tienda(
        item_id, body.model_dump(exclude_unset=True), admin_id=admin.id
    )


@router.get("/reports", response_model=list[AdminReportRow])
async def listar_reportes(
    estado: str | None = Query(None, description="pendiente | revisado | descartado"),
    tipo: str | None = Query(None, description="reporte_usuario | queja | sugerencia | otro"),
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> list[AdminReportRow]:
    return await service.listar_reportes(estado, tipo)


@router.patch("/reports/{report_id}", response_model=AdminReportRow)
async def resolver_reporte(
    report_id: str,
    body: ResolverReporteRequest,
    admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminReportRow:
    return await service.resolver_reporte(report_id, body.status, admin.id)


@router.get("/revenue", response_model=AdminRevenue)
async def ingresos(
    # Solo superadmin: dinero real cobrado y detalle de compras individuales.
    _admin: UserResponse = Depends(require_superadmin),
    service: AdminService = Depends(_service),
) -> AdminRevenue:
    return await service.ingresos()


@router.post("/announcements", response_model=AdminAnnouncementRow)
async def enviar_anuncio(
    body: AnuncioRequest,
    admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminAnnouncementRow:
    # Se persiste y queda "activo": el dashboard de todos lo muestra como
    # banner hasta que un admin lo desactive (o, si se programo, hasta que
    # expires_at pase). No hay email/push todavia.
    return await service.crear_anuncio(
        body.titulo, body.mensaje, admin.id,
        starts_at=body.starts_at, expires_at=body.expires_at,
    )


@router.get("/announcements", response_model=list[AdminAnnouncementRow])
async def listar_anuncios(
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> list[AdminAnnouncementRow]:
    return await service.listar_anuncios()


@router.patch("/announcements/{anuncio_id}/desactivar", response_model=AdminAnnouncementRow)
async def desactivar_anuncio(
    anuncio_id: str,
    admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> AdminAnnouncementRow:
    return await service.desactivar_anuncio(anuncio_id, admin_id=admin.id)


@router.get("/settings", response_model=list[AdminSettingRow])
async def listar_parametros(
    _admin: UserResponse = Depends(require_admin),
    service: AdminService = Depends(_service),
) -> list[AdminSettingRow]:
    return await service.listar_parametros()


@router.post("/settings", response_model=AdminSettingRow)
async def crear_parametro(
    body: CrearParametroRequest,
    # Solo superadmin: un parametro nuevo puede afectar la economia del juego.
    admin: UserResponse = Depends(require_superadmin),
    service: AdminService = Depends(_service),
) -> AdminSettingRow:
    return await service.crear_parametro(
        body.code, body.name, body.value, body.description, admin_id=admin.id
    )


@router.patch("/settings/{setting_id}", response_model=AdminSettingRow)
async def actualizar_parametro(
    setting_id: str,
    body: ActualizarParametroRequest,
    admin: UserResponse = Depends(require_superadmin),
    service: AdminService = Depends(_service),
) -> AdminSettingRow:
    return await service.actualizar_parametro(setting_id, body.value, admin_id=admin.id)


@router.get("/audit", response_model=list[AdminAuditRow])
async def listar_auditoria(
    limite: int = Query(100, ge=1, le=500),
    # Solo superadmin: ve quien hizo que a todo el panel, incluyendo a otros admins.
    _admin: UserResponse = Depends(require_superadmin),
    service: AdminService = Depends(_service),
) -> list[AdminAuditRow]:
    return await service.listar_auditoria(limite)
