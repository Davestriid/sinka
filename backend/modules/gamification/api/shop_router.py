"""
Router de la tienda de cosméticos.

GET  /api/shop/items          — Catálogo completo (con flag owned por usuario)
POST /api/shop/buy/{item_id}  — Comprar un ítem con FocusCoins
GET  /api/shop/inventory      — Inventario del usuario autenticado
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from modules.gamification.repositories.gamification_repository import GamificationRepository
from modules.gamification.repositories.shop_repository import ShopRepository
from modules.gamification.schemas.gamification import BuyItemResponse, ShopItemResponse
from modules.identity.api.dependencies import get_current_user
from modules.identity.schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shop", tags=["shop"])


@router.get("/items", response_model=list[ShopItemResponse])
async def get_shop_items(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ShopItemResponse]:
    """Devuelve todos los ítems activos con flag owned=True si el usuario ya los tiene."""
    shop_repo = ShopRepository(db)
    items     = await shop_repo.get_all_active()
    owned     = await shop_repo.get_user_inventory(current_user.id)

    return [
        ShopItemResponse(
            id          = item.id,
            name        = item.name,
            description = item.description,
            category    = item.category,
            price_fc    = item.price_fc,
            preview     = item.preview,
            owned       = item.id in owned,
        )
        for item in items
    ]


@router.post("/buy/{item_id}", response_model=BuyItemResponse)
async def buy_item(
    item_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BuyItemResponse:
    """Compra un ítem de la tienda descontando FocusCoins del usuario."""
    shop_repo  = ShopRepository(db)
    stats_repo = GamificationRepository(db)

    item = await shop_repo.get_by_id(item_id)
    if item is None or not item.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ítem no encontrado o no disponible.",
        )

    # Ya lo tiene
    if await shop_repo.owns_item(current_user.id, item_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya tienes este ítem en tu inventario.",
        )

    # Verificar saldo
    stats = await stats_repo.get_or_create(current_user.id)
    if stats.focus_coins < item.price_fc:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"FocusCoins insuficientes. Tienes {stats.focus_coins} FC, el ítem cuesta {item.price_fc} FC.",
        )

    # Descontar y agregar al inventario
    stats.focus_coins -= item.price_fc
    await shop_repo.add_to_inventory(current_user.id, item_id)
    await db.commit()

    logger.info(
        "Shop: usuario %s compró '%s' por %d FC (saldo restante: %d FC)",
        current_user.id, item.name, item.price_fc, stats.focus_coins,
    )

    return BuyItemResponse(
        success                = True,
        message                = f"¡{item.name} agregado a tu inventario!",
        focus_coins_remaining  = stats.focus_coins,
        item_id                = item_id,
    )


@router.get("/inventory", response_model=list[ShopItemResponse])
async def get_inventory(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ShopItemResponse]:
    """Devuelve los ítems que posee el usuario autenticado."""
    shop_repo = ShopRepository(db)
    owned_ids = await shop_repo.get_user_inventory(current_user.id)

    if not owned_ids:
        return []

    items = await shop_repo.get_all_active()
    return [
        ShopItemResponse(
            id          = item.id,
            name        = item.name,
            description = item.description,
            category    = item.category,
            price_fc    = item.price_fc,
            preview     = item.preview,
            owned       = True,
        )
        for item in items
        if item.id in owned_ids
    ]
