from fastapi import APIRouter, Depends

from core.rate_limiter import rate_limit
from modules.identity.api.dependencies import get_current_user, get_identity_service
from modules.identity.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from modules.identity.services.identity_service import IdentityService

router = APIRouter(prefix="/auth", tags=["auth"])

# 5 intentos por minuto por IP en endpoints de autenticación
_auth_limit = Depends(rate_limit(max_calls=5, period_sec=60))


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


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user
