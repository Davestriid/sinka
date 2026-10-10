"""
POST /reports      — un usuario reporta a otro
POST /feedback     — queja, sugerencia o comentario general (sin usuario reportado)
GET  /reports/mine — lo que el usuario actual mando, con la respuesta del admin si la hay
Los tres caen en el mismo buzon. Ver /admin/reports para moderacion.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse
from modules.reports.schemas import FeedbackCreate, ReportCreate, ReportResponse
from modules.reports.service import ReportsService

router = APIRouter(tags=["reports"])


def _service(db: AsyncSession = Depends(get_db)) -> ReportsService:
    return ReportsService(db)


@router.post("/reports", response_model=ReportResponse)
async def crear_reporte(
    body: ReportCreate,
    current_user: UserResponse = Depends(get_current_user),
    service: ReportsService = Depends(_service),
) -> ReportResponse:
    return await service.crear(current_user.id, body)


@router.post("/feedback", response_model=ReportResponse)
async def crear_feedback(
    body: FeedbackCreate,
    current_user: UserResponse = Depends(get_current_user),
    service: ReportsService = Depends(_service),
) -> ReportResponse:
    return await service.crear_feedback(current_user.id, body)


@router.get("/reports/mine", response_model=list[ReportResponse])
async def mis_mensajes(
    current_user: UserResponse = Depends(get_current_user),
    service: ReportsService = Depends(_service),
) -> list[ReportResponse]:
    return await service.listar_mios(current_user.id)
