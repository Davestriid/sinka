from fastapi import APIRouter, Depends, Query

from core.catalog import TOPICS
from core.rate_limiter import rate_limit
from modules.identity.api.dependencies import get_current_user, get_identity_service
from modules.identity.schemas.auth import (
    LoginRequest,
    OnboardingRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from modules.identity.services.identity_service import IdentityService

router = APIRouter(prefix="/auth", tags=["auth"])

# Limite por IP en los endpoints de autenticacion.
#
# Eran 5 por minuto, y eso es un problema en una red compartida: en un aula o
# una oficina todo el mundo sale por la misma IP publica, asi que entre varias
# personas agotaban el cupo y la sexta quedaba bloqueada sin haber hecho nada
# malo. Veinte por minuto sigue frenando un ataque por fuerza bruta, que
# necesitaria miles de intentos, y deja trabajar a un grupo normal.
_auth_limit = Depends(rate_limit(max_calls=20, period_sec=60))


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest,
    service: IdentityService = Depends(get_identity_service),
    _rl: None = _auth_limit,
) -> TokenResponse:
    return await service.register(
        email=body.email,
        username=body.username,
        password=body.password,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    service: IdentityService = Depends(get_identity_service),
    _rl: None = _auth_limit,
) -> TokenResponse:
    return await service.login(email=body.email, password=body.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    service: IdentityService = Depends(get_identity_service),
) -> TokenResponse:
    """
    Renueva el token de acceso a partir del de refresco.

    No lleva limitador de intentos porque el navegador lo llama solo, cada vez
    que el token de acceso caduca, y un limite lo dejaria fuera de la sesion.
    """
    return await service.refresh(body.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: ProfileUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: IdentityService = Depends(get_identity_service),
) -> UserResponse:
    """Actualiza alias, avatar, biografia, idioma o tema. Todo es opcional."""
    return await service.update_profile(
        current_user.id,
        body.model_dump(exclude_none=True),
    )


@router.post("/me/onboarding", response_model=UserResponse)
async def complete_onboarding(
    body: OnboardingRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: IdentityService = Depends(get_identity_service),
) -> UserResponse:
    """Cierra el onboarding de cuatro pasos. Se ejecuta una sola vez por cuenta."""
    return await service.complete_onboarding(
        user_id=current_user.id,
        alias=body.alias,
        avatar_url=body.avatar_url,
        interests=body.interests,
        language=body.language,
    )


@router.get("/users/search", response_model=list[UserResponse])
async def search_users(
    # Sin minimo aqui a proposito. Quien escribe en el buscador manda la
    # primera letra antes de terminar de escribir, y rechazarla con un error
    # de validacion hacia aparecer un aviso rojo mientras tecleaba. El
    # servicio ya devuelve una lista vacia si el termino es muy corto.
    q: str = Query("", max_length=50, description="Nombre o alias a buscar"),
    current_user: UserResponse = Depends(get_current_user),
    service: IdentityService = Depends(get_identity_service),
) -> list[UserResponse]:
    """Busca usuarios para enviarles una solicitud de amistad."""
    return await service.search_users(q, actual_id=current_user.id)


# ---------------------------------------------------------------------------
# Catalogo publico de categorias. No requiere autenticacion porque el frontend
# lo necesita en la pantalla de onboarding antes de tener el perfil listo.
# ---------------------------------------------------------------------------

catalog_router = APIRouter(prefix="/catalog", tags=["catalog"])


@catalog_router.get("/topics")
async def list_topics() -> dict:
    """Devuelve las 13 categorias de actividad disponibles."""
    return {"topics": TOPICS}
