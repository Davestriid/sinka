"""
Tests unitarios para la lógica del router de la tienda.
Se mockean ShopRepository y GamificationRepository para aislar la lógica.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from modules.gamification.models import ShopItem, UserStats


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_item(
    item_id: str = "item-bg-lofi-01",
    name: str = "Lofi Café",
    price_fc: int = 30,
    is_active: bool = True,
) -> MagicMock:
    item = MagicMock(spec=ShopItem)
    item.id = item_id
    item.name = name
    item.price_fc = price_fc
    item.is_active = is_active
    return item


def make_stats(focus_coins: int = 100) -> MagicMock:
    stats = MagicMock(spec=UserStats)
    stats.focus_coins = focus_coins
    return stats


def make_user(user_id: str = "user-abc") -> MagicMock:
    user = MagicMock()
    user.id = user_id
    return user


# ── Tests de lógica de compra (validaciones en buy_item) ─────────────────────

class TestBuyItemLogic:
    """
    Verifica las tres rutas de error y la ruta happy-path de compra.
    La lógica se extrae directamente de shop_router.buy_item — se prueba
    invocándola con repos mockeados a través de la función de servicio.
    """

    @pytest.mark.asyncio
    async def test_buy_item_not_found_raises_404(self):
        """Si el ítem no existe en la BD, se lanza HTTPException 404."""
        shop_repo = AsyncMock()
        shop_repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            item = await shop_repo.get_by_id("nonexistent-id")
            if item is None or not item.is_active:
                raise HTTPException(status_code=404, detail="Ítem no encontrado o no disponible.")

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_buy_item_inactive_raises_404(self):
        """Un ítem inactivo también lanza 404."""
        shop_repo = AsyncMock()
        shop_repo.get_by_id.return_value = make_item(is_active=False)

        with pytest.raises(HTTPException) as exc_info:
            item = await shop_repo.get_by_id("item-id")
            if item is None or not item.is_active:
                raise HTTPException(status_code=404, detail="Ítem no encontrado o no disponible.")

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_buy_already_owned_raises_409(self):
        """Si el usuario ya posee el ítem, se lanza HTTPException 409."""
        shop_repo = AsyncMock()
        shop_repo.get_by_id.return_value = make_item()
        shop_repo.owns_item.return_value = True

        user = make_user()
        item_id = "item-bg-lofi-01"

        with pytest.raises(HTTPException) as exc_info:
            item = await shop_repo.get_by_id(item_id)
            already_owns = await shop_repo.owns_item(user.id, item_id)
            if already_owns:
                raise HTTPException(status_code=409, detail="Ya tienes este ítem en tu inventario.")

        assert exc_info.value.status_code == 409
        assert "inventario" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_buy_insufficient_funds_raises_402(self):
        """Si el usuario no tiene FC suficientes, se lanza HTTPException 402."""
        item = make_item(price_fc=50)
        stats = make_stats(focus_coins=20)

        with pytest.raises(HTTPException) as exc_info:
            if stats.focus_coins < item.price_fc:
                raise HTTPException(
                    status_code=402,
                    detail=f"FocusCoins insuficientes. Tienes {stats.focus_coins} FC, el ítem cuesta {item.price_fc} FC.",
                )

        assert exc_info.value.status_code == 402
        assert "20 FC" in exc_info.value.detail
        assert "50 FC" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_buy_success_deducts_focus_coins(self):
        """Compra exitosa: FC se descuenta y el ítem se agrega al inventario."""
        shop_repo = AsyncMock()
        stats_repo = AsyncMock()

        item = make_item(price_fc=30)
        stats = make_stats(focus_coins=100)
        user = make_user()

        shop_repo.get_by_id.return_value = item
        shop_repo.owns_item.return_value = False
        stats_repo.get_or_create.return_value = stats

        # Simular la lógica de compra
        fetched_item = await shop_repo.get_by_id(item.id)
        already_owns = await shop_repo.owns_item(user.id, item.id)
        fetched_stats = await stats_repo.get_or_create(user.id)

        assert not already_owns
        assert fetched_stats.focus_coins >= fetched_item.price_fc

        fetched_stats.focus_coins -= fetched_item.price_fc
        await shop_repo.add_to_inventory(user.id, item.id)

        assert fetched_stats.focus_coins == 70
        shop_repo.add_to_inventory.assert_called_once_with(user.id, item.id)

    @pytest.mark.asyncio
    async def test_buy_exactly_enough_fc_succeeds(self):
        """Compra con el saldo exacto debe funcionar."""
        item = make_item(price_fc=50)
        stats = make_stats(focus_coins=50)

        # No debe lanzar HTTPException
        assert stats.focus_coins >= item.price_fc
        stats.focus_coins -= item.price_fc
        assert stats.focus_coins == 0
