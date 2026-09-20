"""
Endpoints del modulo social.

/friends  → amistades y solicitudes
/garden   → el jardin de vinculos
"""
import logging

from fastapi import APIRouter, Depends, status

from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse
from modules.social.api.dependencies import get_social_service
from modules.social.schemas.social import (
    FriendResponse,
    GardenResponse,
    PlantResponse,
    RenamePlantRequest,
    RequestsResponse,
)
from modules.social.services.social_service import SocialService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/friends", tags=["social"])
garden_router = APIRouter(prefix="/garden", tags=["garden"])


# ---------------------------------------------------------------------------
# Amistades
# ---------------------------------------------------------------------------

@router.get("", response_model=list[FriendResponse])
async def list_friends(
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    """Lista de amigos con el estado de la planta que comparten."""
    return await service.list_friends(current_user.id)


@router.get("/requests", response_model=RequestsResponse)
async def list_requests(
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    """
    Solicitudes recibidas y enviadas, mas cuantas solicitudes quedan hoy.
    El frontend muestra ese contador como "2/3 disponibles hoy".
    """
    return await service.list_requests(current_user.id)


@router.post("/request/{user_id}", status_code=status.HTTP_201_CREATED)
async def send_request(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    """Envia una solicitud de amistad. Gasta una de las tres diarias."""
    return await service.send_request(current_user.id, user_id)


@router.post("/accept/{friendship_id}", response_model=FriendResponse)
async def accept_request(
    friendship_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    """Acepta una solicitud. Aqui nace la planta del vinculo."""
    return await service.accept_request(friendship_id, current_user.id)


@router.post("/reject/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def reject_request(
    friendship_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
) -> None:
    await service.reject_request(friendship_id, current_user.id)


@router.delete("/request/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_request(
    friendship_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
) -> None:
    """Cancela una solicitud propia sin respuesta y recupera la cuota."""
    await service.cancel_request(friendship_id, current_user.id)


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friendship_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
) -> None:
    """Deshace la amistad. La planta compartida se elimina con ella."""
    await service.remove_friend(friendship_id, current_user.id)


@router.post("/block/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def block_user(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
) -> None:
    """Bloquea a alguien. El matchmaking deja de proponerlo como companero."""
    await service.block_user(current_user.id, user_id)


@router.delete("/block/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
) -> None:
    await service.unblock_user(current_user.id, user_id)


@router.get("/blocked", response_model=list[str])
async def list_blocked(
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    return await service.blocked_ids(current_user.id)


# ---------------------------------------------------------------------------
# Jardin
# ---------------------------------------------------------------------------

@garden_router.get("", response_model=GardenResponse)
async def my_garden(
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    """Todas las plantas del usuario, una por cada amistad."""
    return await service.list_garden(current_user.id, lang=current_user.language)


@garden_router.get("/{friendship_id}", response_model=PlantResponse)
async def plant_detail(
    friendship_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    """Detalle de una planta: fase, progreso e historial compartido."""
    return await service.get_plant(friendship_id, current_user.id, lang=current_user.language)


@garden_router.patch("/{friendship_id}", response_model=PlantResponse)
async def rename_plant(
    friendship_id: str,
    body: RenamePlantRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: SocialService = Depends(get_social_service),
):
    """Los dos amigos pueden ponerle nombre a su planta."""
    return await service.rename_plant(friendship_id, current_user.id, body.name)
