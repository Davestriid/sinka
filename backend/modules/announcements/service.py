"""
Lado "usuario" de anuncios: solo leer el mas reciente activo. Crearlos,
listar el historial y desactivarlos es trabajo de moderacion y vive en
modules/admin/service.py (mismo patron que reports y revenue).
"""
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.announcements.models import Announcement
from modules.announcements.schemas import AnnouncementPublic


class AnnouncementsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def activo(self) -> AnnouncementPublic | None:
        ahora = datetime.now(timezone.utc)
        anuncio = (
            await self.db.execute(
                select(Announcement)
                .where(
                    Announcement.activo.is_(True),
                    # Programacion opcional: si starts_at/expires_at estan
                    # vacios, no restringen nada (comportamiento de siempre).
                    or_(Announcement.starts_at.is_(None), Announcement.starts_at <= ahora),
                    or_(Announcement.expires_at.is_(None), Announcement.expires_at > ahora),
                )
                .order_by(Announcement.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        return AnnouncementPublic.model_validate(anuncio) if anuncio else None
