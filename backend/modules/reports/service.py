"""
Servicio del buzon: solo la mitad "usuario" (crear un reporte o un mensaje
general). Leerlos y resolverlos es trabajo de moderacion y vive en
modules/admin/service.py, igual que admin ya lee CoinPurchase de
modules/payments sin duplicar logica.
"""
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from modules.identity.repositories.user_repository import UserRepository
from modules.reports.models import Report
from modules.reports.schemas import (
    RAZONES_VALIDAS,
    TIPOS_VALIDOS,
    FeedbackCreate,
    ReportCreate,
    ReportResponse,
)


class ReportsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    async def crear(self, reporter_id: str, body: ReportCreate) -> ReportResponse:
        if body.reason not in RAZONES_VALIDAS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Razon invalida. Opciones: {RAZONES_VALIDAS}",
            )
        if body.reported_user_id == reporter_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes reportarte a ti mismo.",
            )
        reportado = await self.user_repo.get_by_id(body.reported_user_id)
        if not reportado:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        reporte = Report(
            reporter_id=reporter_id,
            reported_user_id=body.reported_user_id,
            tipo="reporte_usuario",
            reason=body.reason,
            details=body.details,
        )
        self.db.add(reporte)
        await self.db.commit()
        await self.db.refresh(reporte)
        return ReportResponse.model_validate(reporte)

    async def crear_feedback(self, reporter_id: str, body: FeedbackCreate) -> ReportResponse:
        tipos_feedback = [t for t in TIPOS_VALIDOS if t != "reporte_usuario"]
        if body.tipo not in tipos_feedback:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Tipo invalido. Opciones: {tipos_feedback}",
            )
        item = Report(
            reporter_id=reporter_id,
            reported_user_id=None,
            tipo=body.tipo,
            reason=body.tipo,
            details=body.mensaje,
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return ReportResponse.model_validate(item)
