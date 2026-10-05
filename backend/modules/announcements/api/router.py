"""GET /announcements/active — el anuncio vigente, si hay uno. Ver /admin/announcements para enviar/gestionar."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.announcements.schemas import AnnouncementPublic
from modules.announcements.service import AnnouncementsService
from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _service(db: AsyncSession = Depends(get_db)) -> AnnouncementsService:
    return AnnouncementsService(db)


@router.get("/active", response_model=AnnouncementPublic | None)
async def anuncio_activo(
    _user: UserResponse = Depends(get_current_user),
    service: AnnouncementsService = Depends(_service),
) -> AnnouncementPublic | None:
    return await service.activo()
