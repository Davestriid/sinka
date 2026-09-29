"""
Router de logros.

GET /api/achievements — catálogo completo con el progreso del usuario.
"""
from fastapi import APIRouter, Depends

from modules.achievements.schemas.achievements import AchievementsSummary
from modules.achievements.services.achievements_service import achievements_service
from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=AchievementsSummary)
async def get_my_achievements(
    current_user: UserResponse = Depends(get_current_user),
) -> AchievementsSummary:
    """
    Catálogo de los 18 logros con el progreso del usuario autenticado.

    Se recalcula al vuelo (no hay tabla de progreso salvo lo ya desbloqueado)
    y de paso desbloquea cualquiera que ya se cumpla pero que un evento
    anterior no haya alcanzado a revisar — así nadie se queda con un logro
    "atrasado" solo por no haber entrado a la app justo cuando lo cumplió.
    """
    await achievements_service.evaluate_for_user(current_user.id)
    data = await achievements_service.get_summary(current_user.id)
    return AchievementsSummary(**data)
