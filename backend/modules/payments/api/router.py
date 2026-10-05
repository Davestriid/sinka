"""
GET  /payments/packs              — catalogo de paquetes de FocusCoins
POST /payments/checkout           — crea la sesion de Stripe y devuelve la URL
POST /payments/webhook            — Stripe llama aqui a confirmar un pago (sin auth de usuario)
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse
from modules.payments.catalog import COIN_PACKS
from modules.payments.schemas import CheckoutResponse, CoinPackResponse, CrearCheckoutRequest
from modules.payments.service import PaymentsService

router = APIRouter(prefix="/payments", tags=["payments"])


def _service(db: AsyncSession = Depends(get_db)) -> PaymentsService:
    return PaymentsService(db)


@router.get("/packs", response_model=list[CoinPackResponse])
async def listar_paquetes() -> list[CoinPackResponse]:
    return [
        CoinPackResponse(id=p.id, nombre=p.nombre, coins=p.coins, precio_centavos=p.precio_centavos)
        for p in COIN_PACKS.values()
    ]


@router.post("/checkout", response_model=CheckoutResponse)
async def crear_checkout(
    body: CrearCheckoutRequest,
    current_user: UserResponse = Depends(get_current_user),
    service: PaymentsService = Depends(_service),
) -> CheckoutResponse:
    url = await service.crear_checkout(current_user.id, current_user.email, body.pack_id)
    return CheckoutResponse(checkout_url=url)


@router.post("/webhook")
async def webhook_stripe(
    request: Request,
    service: PaymentsService = Depends(_service),
) -> dict:
    """
    Sin Depends(get_current_user) a proposito: quien llama esto es Stripe,
    no un usuario de SINKA. La autenticidad se valida con la firma del
    header Stripe-Signature contra STRIPE_WEBHOOK_SECRET, no con un token.
    """
    payload = await request.body()
    firma = request.headers.get("stripe-signature", "")
    await service.procesar_webhook(payload, firma)
    return {"received": True}
