"""
Lado "usuario" de anuncios: solo leer el mas reciente activo. Crearlos,
listar el historial y desactivarlos es trabajo de moderacion y vive en
modules/admin/service.py (mismo patron que reports y revenue).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.announcements.models import Announcement
from modules.announcements.schemas import AnnouncementPublic


class AnnouncementsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def activo(self) -> AnnouncementPublic | None:
        anuncio = (
            await self.db.execute(
                select(Announcement)
                .where(Announcement.activo.is_(True))
                .order_by(Announcement.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        return AnnouncementPublic.model_validate(anuncio) if anuncio else None
