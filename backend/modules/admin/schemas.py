from datetime import datetime

from pydantic import BaseModel


class AdminUserRow(BaseModel):
    id: str
    email: str
    username: str
    alias: str | None = None
    role: str
    is_active: bool
    is_banned: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserList(BaseModel):
    items: list[AdminUserRow]
    total: int
    pagina: int
    por_pagina: int


class CambiarRolRequest(BaseModel):
    role: str  # "usuario" | "admin" | "superadmin"


class AdminStats(BaseModel):
    total_usuarios: int
    usuarios_banneados: int
    total_sesiones: int
    total_pomodoros: int
    focuscoins_en_circulacion: int
    items_en_tienda: int


class AnuncioRequest(BaseModel):
    titulo: str
    mensaje: str


class AdminShopItemRow(BaseModel):
    id: str
    name: str
    description: str
    category: str
    price_fc: int
    preview: str
    is_active: bool

    model_config = {"from_attributes": True}


class AdminPurchaseRow(BaseModel):
    id: str
    user_id: str
    pack_id: str
    coins: int
    precio_centavos: int
    estado: str
    created_at: datetime
    paid_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdminRevenue(BaseModel):
    ingresos_centavos: int
    compras_pagadas: int
    compras: list[AdminPurchaseRow]


class EditarItemTiendaRequest(BaseModel):
    """Todo opcional: solo se cambia lo que se envia."""
    name:        str | None = None
    description: str | None = None
    price_fc:    int | None = None
    is_active:   bool | None = None
