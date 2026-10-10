"""
Endpoints del modulo de grupos.

REST para crear, explorar y administrar grupos.
WebSocket para la sala de espera previa a la sesion conjunta.
"""
import logging

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db
from core.ws_auth import get_current_user_ws
from modules.groups.repositories.group_repository import GroupRepository
from modules.groups.schemas.groups import (
    CreateGroupRequest,
    GroupResponse,
    InviteCodeResponse,
    JoinByCodeRequest,
    UpdateGroupRequest,
)
from modules.groups.services.group_service import GroupService
from modules.groups.services.group_session_service import group_session_service
from modules.groups.services.lobby_service import lobby_service
from modules.identity.api.dependencies import get_current_user
from modules.identity.repositories.user_repository import UserRepository
from modules.identity.schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["groups"])


def get_group_service(db: AsyncSession = Depends(get_db)) -> GroupService:
    return GroupService(group_repo=GroupRepository(db), user_repo=UserRepository(db))


# ---------------------------------------------------------------------------
# Explorar y consultar
# ---------------------------------------------------------------------------

@router.get("/explore", response_model=list[GroupResponse])
async def explore(
    topic: str | None = Query(None, description="Filtrar por categoria"),
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """Grupos publicos con cupo disponible."""
    return await service.explore(current_user.id, topic)


@router.get("/mine", response_model=list[GroupResponse])
async def my_groups(
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """Grupos a los que pertenece el usuario."""
    return await service.my_groups(current_user.id)


@router.get("/{group_id}", response_model=GroupResponse)
async def detail(
    group_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """Detalle del grupo con su lista de integrantes."""
    return await service.detail(group_id, current_user.id)


# ---------------------------------------------------------------------------
# Crear y administrar
# ---------------------------------------------------------------------------

@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: CreateGroupRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """
    Crea un grupo. Los publicos quedan abiertos a desconocidos, y por eso en
    ellos compartir pantalla pasa a ser obligatorio durante la sesion.
    """
    return await service.create(
        owner_id=current_user.id,
        name=body.name,
        topic=body.topic,
        visibility=body.visibility,
        description=body.description,
        default_task=body.default_task,
        open_to_strangers=body.open_to_strangers,
    )


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    body: UpdateGroupRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    return await service.update(group_id, current_user.id, body.model_dump(exclude_none=True))


@router.post("/{group_id}/code", response_model=InviteCodeResponse)
async def regenerate_code(
    group_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """Genera un codigo nuevo y anula el anterior."""
    return await service.regenerate_code(group_id, current_user.id)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disband(
    group_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
) -> None:
    await service.disband(group_id, current_user.id)


# ---------------------------------------------------------------------------
# Entrar y salir
# ---------------------------------------------------------------------------

@router.post("/{group_id}/join", response_model=GroupResponse)
async def join_public(
    group_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    return await service.join_public(group_id, current_user.id)


@router.post("/join", response_model=GroupResponse)
async def join_by_code(
    body: JoinByCodeRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """Entra a un grupo privado con su codigo de invitacion."""
    return await service.join_by_code(body.code, current_user.id)


@router.delete("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave(
    group_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
) -> None:
    await service.leave(group_id, current_user.id)


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def kick(
    group_id: str,
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
) -> None:
    await service.kick(group_id, current_user.id, user_id)


@router.post("/{group_id}/transfer/{user_id}", response_model=GroupResponse)
async def transfer_ownership(
    group_id: str,
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """Traspasa la propiedad del grupo a otro integrante."""
    return await service.transfer_ownership(group_id, current_user.id, user_id)


# ---------------------------------------------------------------------------
# Sala de espera
# ---------------------------------------------------------------------------

@router.websocket("/{group_id}/lobby")
async def group_lobby(
    websocket: WebSocket,
    group_id: str,
    current_user: UserResponse = Depends(get_current_user_ws),
) -> None:
    """
    Sala de espera del grupo.

    Cliente → Servidor  {"type": "READY", "payload": {"ready": true}}
    Cliente → Servidor  {"type": "SCREEN_SHARE", "payload": {"sharing": true}}
    Cliente → Servidor  {"type": "START"}
    Servidor → Cliente  {"type": "LOBBY_STATE", "payload": {...}}
    Servidor → Cliente  {"type": "SESSION_STARTED", "payload": {...}}
    Servidor → Cliente  {"type": "ERROR", "detail": "..."}
    """
    await websocket.accept()

    # Solo entran los integrantes del grupo
    async with AsyncSessionLocal() as db:
        repo = GroupRepository(db)
        grupo = await repo.get_by_id(group_id)
        if grupo is None:
            await websocket.send_json({"type": "ERROR", "detail": "Ese grupo no existe."})
            await websocket.close()
            return

        miembro = await repo.get_membership(group_id, current_user.id)
        if miembro is None:
            await websocket.send_json({
                "type": "ERROR",
                "detail": "No perteneces a este grupo.",
            })
            await websocket.close()
            return

        owner_id = grupo.owner_id
        requiere_pantalla = grupo.requires_screen_share

    await lobby_service.connect(
        group_id=group_id,
        user_id=current_user.id,
        username=current_user.alias or current_user.username,
        avatar_url=current_user.avatar_url,
        owner_id=owner_id,
        requires_screen_share=requiere_pantalla,
        websocket=websocket,
    )

    try:
        while True:
            msg = await websocket.receive_json()
            tipo = msg.get("type")
            payload = msg.get("payload", {}) or {}

            if tipo == "READY":
                await lobby_service.set_ready(
                    group_id, current_user.id, bool(payload.get("ready", False))
                )

            elif tipo == "SCREEN_SHARE":
                await lobby_service.set_screen_share(
                    group_id, current_user.id, bool(payload.get("sharing", False))
                )

            elif tipo == "START":
                resultado = await lobby_service.start_session(group_id, current_user.id)
                if not resultado.get("ok"):
                    await websocket.send_json({
                        "type":   "ERROR",
                        "detail": resultado.get("reason", "No se pudo iniciar la sesion."),
                    })

            elif tipo == "PING":
                await websocket.send_json({"type": "PONG"})

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Lobby: error inesperado en el grupo %s", group_id)
    finally:
        await lobby_service.disconnect(group_id, current_user.id)


@router.get("/{group_id}/lobby/state")
async def lobby_state(
    group_id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: GroupService = Depends(get_group_service),
):
    """Estado de la sala sin abrir WebSocket. Util para la lista de grupos."""
    await service.detail(group_id, current_user.id)  # valida el acceso
    return lobby_service.snapshot(group_id)


# ---------------------------------------------------------------------------
# Sesion grupal (2 a 8 personas trabajando juntas, tras la sala de espera)
# ---------------------------------------------------------------------------

@router.websocket("/{group_id}/session/{session_id}")
async def group_session_websocket(
    websocket: WebSocket,
    group_id: str,
    session_id: str,
    current_user: UserResponse = Depends(get_current_user_ws),
) -> None:
    """
    Canal de la sesion grupal: temporizador Pomodoro compartido, relevo de
    señales WebRTC (cada participante arma su propia conexion con cada uno
    de los demas — malla, no estrella) y chat para todos.

    Cliente -> Servidor:
      {"type": "SIGNAL", "payload": {"target": "<user_id>", "data": {...}}}
      {"type": "CHAT",   "payload": {"text": "..."}}
      {"type": "PING"}

    Servidor -> Cliente:
      ROOM_STATE          Al conectar: quien mas esta ya adentro + el timer
      PARTICIPANT_JOINED  Alguien se sumo (armar conexion WebRTC con el/ella)
      PARTICIPANT_LEFT    Alguien se fue (cerrar esa conexion WebRTC)
      TIMER_TICK          Cada segundo mientras haya al menos una persona
      SIGNAL              Señal WebRTC reenviada de otro participante
      CHAT_MESSAGE         Mensaje de otro participante
      SESSION_ENDED        reason: timer_completed | sola | vaciado
      ERROR
    """
    await websocket.accept()

    conectado = await group_session_service.connect(session_id, current_user.id, websocket)
    if not conectado:
        await websocket.send_json({
            "type":   "ERROR",
            "detail": "Esa sesion de grupo no existe o ya termino.",
        })
        await websocket.close(code=4004)
        return

    try:
        while True:
            msg = await websocket.receive_json()
            tipo = msg.get("type")
            payload = msg.get("payload", {}) or {}

            if tipo == "SIGNAL":
                target = payload.get("target")
                data = payload.get("data")
                if target and data is not None:
                    await group_session_service.relay_signal(
                        session_id, current_user.id, target, data
                    )

            elif tipo == "CHAT":
                texto = (payload.get("text") or "").strip()[:500]
                if texto:
                    await group_session_service.relay_chat(session_id, current_user.id, texto)

            elif tipo == "PING":
                await websocket.send_json({"type": "PONG"})

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("GroupSession: error inesperado en la sesion %s", session_id)
    finally:
        await group_session_service.disconnect(session_id, current_user.id)
