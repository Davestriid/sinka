"""
Servicio del panel de administracion.

No tiene su propia tabla de "configuracion": lee y escribe directamente
sobre modelos de otros modulos (users, user_stats, shop_items). Es un panel
de operacion, no un dueno de datos nuevos.
"""
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.admin.schemas import (
    AdminPurchaseRow,
    AdminRevenue,
    AdminShopItemRow,
    AdminStats,
    AdminUserList,
    AdminUserRow,
)
from modules.gamification.models import ShopItem, UserStats
from modules.identity.models import User
from modules.identity.repositories.user_repository import UserRepository
from modules.payments.models import CoinPurchase
from modules.sessions.models import FocusSession

ROLES_VALIDOS = ("usuario", "admin", "superadmin")


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    async def listar_usuarios(self, termino: str | None, pagina: int, por_pagina: int) -> AdminUserList:
        usuarios, total = await self.user_repo.listar_admin(termino, pagina, por_pagina)
        return AdminUserList(
            items=[AdminUserRow.model_validate(u) for u in usuarios],
            total=total,
            pagina=pagina,
            por_pagina=por_pagina,
        )

    async def banear(self, user_id: str, banear: bool) -> AdminUserRow:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        user.is_banned = banear
        await self.db.commit()
        await self.db.refresh(user)
        return AdminUserRow.model_validate(user)

    async def cambiar_rol(self, user_id: str, nuevo_rol: str, quien_lo_pide_id: str) -> AdminUserRow:
        if nuevo_rol not in ROLES_VALIDOS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Rol invalido. Opciones: {ROLES_VALIDOS}",
            )
        if user_id == quien_lo_pide_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes cambiar tu propio rol.",
            )
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        user.role = nuevo_rol
        await self.db.commit()
        await self.db.refresh(user)
        return AdminUserRow.model_validate(user)

    async def listar_items_tienda(self) -> list[AdminShopItemRow]:
        items = (await self.db.execute(select(ShopItem).order_by(ShopItem.category))).scalars().all()
        return [AdminShopItemRow.model_validate(i) for i in items]

    async def editar_item_tienda(self, item_id: str, cambios: dict) -> AdminShopItemRow:
        item = (
            await self.db.execute(select(ShopItem).where(ShopItem.id == item_id))
        ).scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item no encontrado.")
        for campo, valor in cambios.items():
            if valor is not None:
                setattr(item, campo, valor)
        await self.db.commit()
        await self.db.refresh(item)
        return AdminShopItemRow.model_validate(item)

    async def ingresos(self, limite: int = 50) -> AdminRevenue:
        """Solo superadmin: dinero real cobrado via Stripe (ver router)."""
        pagadas = (
            await self.db.execute(select(CoinPurchase).where(CoinPurchase.estado == "pagado"))
        ).scalars().all()
        total_centavos = sum(c.precio_centavos for c in pagadas)

        recientes = (
            await self.db.execute(
                select(CoinPurchase).order_by(CoinPurchase.created_at.desc()).limit(limite)
            )
        ).scalars().all()

        return AdminRevenue(
            ingresos_centavos=total_centavos,
            compras_pagadas=len(pagadas),
            compras=[AdminPurchaseRow.model_validate(c) for c in recientes],
        )

    async def estadisticas(self) -> AdminStats:
        total_usuarios = await self.user_repo.contar_todos()
        banneados = (
            await self.db.execute(select(func.count(User.id)).where(User.is_banned.is_(True)))
        ).scalar_one()
        total_sesiones = (await self.db.execute(select(func.count(FocusSession.id)))).scalar_one()
        pomodoros = (
            await self.db.execute(select(func.coalesce(func.sum(UserStats.pomodoros_completed), 0)))
        ).scalar_one()
        coins = (
            await self.db.execute(select(func.coalesce(func.sum(UserStats.focus_coins), 0)))
        ).scalar_one()
        items_tienda = (await self.db.execute(select(func.count(ShopItem.id)))).scalar_one()

        return AdminStats(
            total_usuarios=total_usuarios,
            usuarios_banneados=banneados,
            total_sesiones=total_sesiones,
            total_pomodoros=int(pomodoros),
            focuscoins_en_circulacion=int(coins),
            items_en_tienda=items_tienda,
        )
