"""Endpoints de citas programadas."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.groups.repositories.group_repository import GroupRepository
from modules.identity.api.dependencies import get_current_user
from modules.identity.repositories.user_repository import UserRepository
from modules.identity.schemas.auth import UserResponse
from modules.scheduling.repositories.appointment_repository import (
    AppointmentQuotaRepository,
    AppointmentRepository,
)
from modules.scheduling.schemas.scheduling import (
    AgendaResponse,
    AppointmentResponse,
    CreateAppointmentRequest,
)
from modules.scheduling.services.scheduling_service import SchedulingService
from modules.social.repositories.social_repository import FriendshipRepository

router = APIRouter(prefix="/appointments", tags=["appointments"])


def get_scheduling_service(db: AsyncSession = Depends(get_db)) -> SchedulingService:
    return SchedulingService(
        appt_repo=AppointmentRepository(db),
        quota_repo=AppointmentQuotaRepository(db),
        friend_repo=FriendshipRepository(db),
        group_repo=GroupRepository(db),
        user_repo=UserRepository(db),
    )


@router.get("", response_model=AgendaResponse)
async def my_agenda(
    current_user: UserResponse = Depends(get_current_user),
    service: SchedulingService = Depends(get_scheduling_service),
):
    """
    Agenda del usuario con las citas proximas, las de hoy y cuantas puede
    seguir creando. El frontend muestra ese contador como "2/3 disponibles hoy".
    """
    return await service.list_mine(current_user.id)


@router.get("/invitations", response_model=list[AppointmentResponse])
async def my_invitations(
    current_user: UserResponse = Depends(get_current_user),
    service: SchedulingService = Depends(get_scheduling_service),
):
    """Invitaciones recibidas que aun no responde."""
    return await service.list_invitations(current_user.id)


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    body: CreateAppointmentRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: SchedulingService = Depends(get_scheduling_service),
):
    """
    Agenda una sesion con un amigo o con un grupo.

    Gasta uno de los tres cupos diarios. Las citas con una persona nacen
    pendientes de respuesta; las de grupo nacen confirmadas.
    """
    return await service.create(
        creator_id=current_user.id,
        scheduled_for=body.scheduled_for,
        topic=body.topic,
        duration_minutes=body.duration_minutes,
        invitee_id=body.invitee_id,
        group_id=body.group_id,
        title=body.title,
    )


@router.post("/{appointment_id}/accept", response_model=AppointmentResponse)
async def accept(
    appointment_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SchedulingService = Depends(get_scheduling_service),
):
    return await service.accept(appointment_id, current_user.id)


@router.post("/{appointment_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline(
    appointment_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SchedulingService = Depends(get_scheduling_service),
) -> None:
    """Rechaza la invitacion. Quien la creo recupera su cupo."""
    await service.decline(appointment_id, current_user.id)


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel(
    appointment_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: SchedulingService = Depends(get_scheduling_service),
) -> None:
    await service.cancel(appointment_id, current_user.id)
