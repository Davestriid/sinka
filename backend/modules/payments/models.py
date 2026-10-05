import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class CoinPurchase(Base):
    """
    Un intento de compra de FocusCoins con dinero real.

    Se crea en "pendiente" cuando el usuario pide el Checkout de Stripe, y
    pasa a "pagado" solo cuando llega el webhook de Stripe confirmando el
    cobro — nunca antes, para no regalar monedas por una pestaña que se
    cerro a medias. `stripe_session_id` es unico: si Stripe reintenta el
    mismo webhook (puede pasar), el segundo intento no vuelve a acreditar.
    """
    __tablename__ = "coin_purchases"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pack_id:          Mapped[str] = mapped_column(String(40), nullable=False)
    coins:             Mapped[int] = mapped_column(Integer, nullable=False)
    precio_centavos:   Mapped[int] = mapped_column(Integer, nullable=False)
    stripe_session_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # "pendiente" | "pagado" | "fallido"
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    paid_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
