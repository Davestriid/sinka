"""
Compra de FocusCoins con dinero real, via Stripe Checkout.

Flujo:
  1. El usuario elige un paquete -> POST /payments/checkout
     -> creamos una fila "pendiente" en coin_purchases y una Checkout
        Session en Stripe -> devolvemos la URL para redirigir al usuario.
  2. El usuario paga en la pagina de Stripe (nunca en SINKA: la tarjeta no
     pasa por nuestro backend en ningun momento).
  3. Stripe nos avisa por webhook (POST /payments/webhook) que el pago se
     completo -> ahi, y SOLO ahi, se acreditan los coins. Nunca se
     acreditan en el paso 1 ni al volver el usuario a la pagina de exito,
     porque esa vuelta la puede falsificar cualquiera con solo conocer la URL.
"""
import logging

import stripe
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from modules.gamification.repositories.gamification_repository import GamificationRepository
from modules.payments.catalog import obtener_pack
from modules.payments.models import CoinPurchase

logger = logging.getLogger(__name__)


class PaymentsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.gamification_repo = GamificationRepository(db)

    def _requiere_stripe_configurado(self) -> None:
        if not settings.stripe_secret_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Los pagos todavia no estan configurados en este servidor.",
            )
        stripe.api_key = settings.stripe_secret_key

    async def crear_checkout(self, user_id: str, user_email: str, pack_id: str) -> str:
        self._requiere_stripe_configurado()

        pack = obtener_pack(pack_id)
        if not pack:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado.")

        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            customer_email=user_email,
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": pack.precio_centavos,
                    "product_data": {
                        "name": f"SINKA — {pack.nombre} ({pack.coins} FocusCoins)",
                    },
                },
                "quantity": 1,
            }],
            metadata={"user_id": user_id, "pack_id": pack.id},
            success_url=f"{settings.frontend_url}/shop?pago=exito",
            cancel_url=f"{settings.frontend_url}/shop?pago=cancelado",
        )

        compra = CoinPurchase(
            user_id=user_id,
            pack_id=pack.id,
            coins=pack.coins,
            precio_centavos=pack.precio_centavos,
            stripe_session_id=session.id,
            estado="pendiente",
        )
        self.db.add(compra)
        await self.db.commit()

        return session.url

    async def procesar_webhook(self, payload: bytes, firma: str) -> None:
        self._requiere_stripe_configurado()

        try:
            event = stripe.Webhook.construct_event(payload, firma, settings.stripe_webhook_secret)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.warning("Webhook de Stripe rechazado: %s", e)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firma invalida.")

        if event["type"] != "checkout.session.completed":
            return  # no es el evento que nos interesa; Stripe manda muchos tipos

        session = event["data"]["object"]
        stripe_session_id = session["id"]

        compra = (
            await self.db.execute(
                select(CoinPurchase).where(CoinPurchase.stripe_session_id == stripe_session_id)
            )
        ).scalar_one_or_none()

        if not compra:
            logger.warning("Webhook de una sesion que no tenemos registrada: %s", stripe_session_id)
            return
        if compra.estado == "pagado":
            return  # Stripe reintento el mismo webhook; no acreditar dos veces

        compra.estado = "pagado"
        compra.paid_at = func.now()

        stats = await self.gamification_repo.get_or_create(compra.user_id)
        stats.focus_coins += compra.coins
        await self.gamification_repo.save(stats)

        await self.db.commit()
        logger.info("Acreditados %s FocusCoins a %s (compra %s)", compra.coins, compra.user_id, compra.id)
