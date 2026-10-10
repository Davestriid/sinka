from datetime import datetime

from pydantic import BaseModel, Field


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
    # Programacion opcional: si no se mandan, el anuncio se comporta como
    # siempre (visible de inmediato, hasta desactivarlo a mano).
    starts_at:  datetime | None = None
    expires_at: datetime | None = None


class AdminAnnouncementRow(BaseModel):
    id: str
    titulo: str
    mensaje: str
    activo: bool
    created_at: datetime
    starts_at:  datetime | None = None
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


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


class AdminReportRow(BaseModel):
    id: str
    reporter_id: str
    reporter_username: str | None = None
    reported_user_id: str | None = None
    reported_username: str | None = None
    tipo: str
    reason: str
    details: str | None = None
    status: str
    created_at: datetime
    resolved_at: datetime | None = None
    admin_reply: str | None = None
    replied_at: datetime | None = None
    replied_by_username: str | None = None

    model_config = {"from_attributes": True}


class ResolverReporteRequest(BaseModel):
    status: str  # "revisado" | "descartado"


class ResponderReporteRequest(BaseModel):
    mensaje: str = Field(min_length=1, max_length=1000)


class EditarItemTiendaRequest(BaseModel):
    """Todo opcional: solo se cambia lo que se envia."""
    name:        str | None = None
    description: str | None = None
    price_fc:    int | None = None
    is_active:   bool | None = None


class AdminSettingRow(BaseModel):
    id: str
    code: str
    name: str
    value: dict
    description: str | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ActualizarParametroRequest(BaseModel):
    value: dict


class CrearParametroRequest(BaseModel):
    code: str
    name: str
    value: dict
    description: str | None = None


class AdminGroupRow(BaseModel):
    id: str
    name: str
    topic: str
    visibility: str
    owner_id: str
    owner_username: str | None = None
    member_count: int
    max_members: int
    created_at: datetime


class AdminAuditRow(BaseModel):
    id: str
    admin_id: str
    admin_username: str | None = None
    accion: str
    objetivo_tipo: str | None = None
    objetivo_id: str | None = None
    detalle: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
