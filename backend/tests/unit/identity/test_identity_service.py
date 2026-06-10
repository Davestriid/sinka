"""
Tests unitarios para IdentityService.
Ciclo TDD: RED → GREEN → REFACTOR.
Los repositorios se reemplazan por mocks para aislar la lógica de negocio.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from modules.identity.models import User
from modules.identity.services.identity_service import IdentityService


# ── Fixtures ───────────────────────────────────────────────────────────────


@pytest.fixture
def user_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.email_exists.return_value = False
    repo.username_exists.return_value = False
    return repo


@pytest.fixture
def session_repo() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def service(user_repo: AsyncMock, session_repo: AsyncMock) -> IdentityService:
    return IdentityService(user_repo=user_repo, session_repo=session_repo)


def make_user(**kwargs) -> User:
    defaults = {
        "id": "user-123",
        "email": "test@example.com",
        "username": "testuser",
        "hashed_password": "$2b$12$fakehash",
        "is_active": True,
    }
    defaults.update(kwargs)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


# ── Hash y verificación de contraseña ─────────────────────────────────────


def test_hash_password_returns_different_string(service: IdentityService):
    hashed = service.hash_password("mipassword123")
    assert hashed != "mipassword123"
    assert len(hashed) > 20


def test_verify_password_correct(service: IdentityService):
    hashed = service.hash_password("mipassword123")
    assert service.verify_password("mipassword123", hashed) is True


def test_verify_password_incorrect(service: IdentityService):
    hashed = service.hash_password("mipassword123")
    assert service.verify_password("incorrecta", hashed) is False


# ── Creación y decodificación de tokens ────────────────────────────────────


def test_create_access_token_returns_string(service: IdentityService):
    token = service.create_access_token("user-123")
    assert isinstance(token, str)
    assert len(token) > 0


def test_decode_access_token_contains_sub(service: IdentityService):
    token = service.create_access_token("user-123")
    payload = service.decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_create_refresh_token_returns_token_and_expiry(service: IdentityService):
    token, expires_at = service.create_refresh_token("user-123")
    assert isinstance(token, str)
    assert isinstance(expires_at, datetime)
    assert expires_at > datetime.now(timezone.utc)


def test_decode_invalid_token_raises_401(service: IdentityService):
    with pytest.raises(HTTPException) as exc_info:
        service.decode_token("token.invalido.firma")
    assert exc_info.value.status_code == 401


# ── Registro ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_success(service: IdentityService, user_repo: AsyncMock, session_repo: AsyncMock):
    user_repo.create.return_value = make_user()

    result = await service.register("nuevo@example.com", "nuevo_user", "password123")

    assert result.access_token
    assert result.refresh_token
    assert result.token_type == "bearer"
    user_repo.create.assert_called_once()
    session_repo.create.assert_called_once()


@pytest.mark.asyncio
async def test_register_duplicate_email_raises_409(service: IdentityService, user_repo: AsyncMock):
    user_repo.email_exists.return_value = True

    with pytest.raises(HTTPException) as exc_info:
        await service.register("existente@example.com", "user1", "password123")

    assert exc_info.value.status_code == 409
    assert "correo" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_register_duplicate_username_raises_409(service: IdentityService, user_repo: AsyncMock):
    user_repo.email_exists.return_value = False
    user_repo.username_exists.return_value = True

    with pytest.raises(HTTPException) as exc_info:
        await service.register("nuevo@example.com", "yaexiste", "password123")

    assert exc_info.value.status_code == 409
    assert "usuario" in exc_info.value.detail.lower()


# ── Login ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_success(service: IdentityService, user_repo: AsyncMock, session_repo: AsyncMock):
    hashed = service.hash_password("correcta123")
    user_repo.get_by_email.return_value = make_user(hashed_password=hashed)

    result = await service.login("test@example.com", "correcta123")

    assert result.access_token
    assert result.refresh_token


@pytest.mark.asyncio
async def test_login_wrong_password_raises_401(service: IdentityService, user_repo: AsyncMock):
    hashed = service.hash_password("correcta123")
    user_repo.get_by_email.return_value = make_user(hashed_password=hashed)

    with pytest.raises(HTTPException) as exc_info:
        await service.login("test@example.com", "incorrecta")

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user_raises_401(service: IdentityService, user_repo: AsyncMock):
    user_repo.get_by_email.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        await service.login("noexiste@example.com", "cualquier")

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_login_inactive_user_raises_403(service: IdentityService, user_repo: AsyncMock):
    hashed = service.hash_password("password123")
    user_repo.get_by_email.return_value = make_user(hashed_password=hashed, is_active=False)

    with pytest.raises(HTTPException) as exc_info:
        await service.login("test@example.com", "password123")

    assert exc_info.value.status_code == 403


# ── get_current_user ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_current_user_success(service: IdentityService, user_repo: AsyncMock):
    user_repo.get_by_id.return_value = make_user()
    token = service.create_access_token("user-123")

    result = await service.get_current_user(token)

    assert result.id == "user-123"
    assert result.email == "test@example.com"


@pytest.mark.asyncio
async def test_get_current_user_with_refresh_token_raises_401(service: IdentityService):
    refresh_token, _ = service.create_refresh_token("user-123")

    with pytest.raises(HTTPException) as exc_info:
        await service.get_current_user(refresh_token)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_not_found_raises_401(service: IdentityService, user_repo: AsyncMock):
    user_repo.get_by_id.return_value = None
    token = service.create_access_token("user-inexistente")

    with pytest.raises(HTTPException) as exc_info:
        await service.get_current_user(token)

    assert exc_info.value.status_code == 401
