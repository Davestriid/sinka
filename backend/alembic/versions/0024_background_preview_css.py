"""0024 — fondos de la tienda: preview pasa de emoji a CSS real

Mismo cambio que la migracion 0022 hizo para profile_banner: el valor de
`preview` en la categoria "background" deja de ser un emoji decorativo y
pasa a ser el fondo CSS real (degradado) que ahora SI se aplica de verdad
como `background` del Dashboard cuando el usuario equipa ese item — ver
equipped_background_item_id (migracion 0023).

Revision ID: 0024
Revises: 0023
Create Date: 2026-10-16
"""
from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None

NUEVOS = {
    "item-bg-lofi-01":   "linear-gradient(135deg, #4a3220, #c9a56a)",
    "item-bg-forest-01": "linear-gradient(135deg, #16281d, #5c8f6b)",
    "item-bg-space-01":  "linear-gradient(135deg, #0b0e2e, #4a2f7a)",
}

ANTERIORES = {
    "item-bg-lofi-01":   "☕",
    "item-bg-forest-01": "🌲",
    "item-bg-space-01":  "🌌",
}


def upgrade() -> None:
    for item_id, css in NUEVOS.items():
        op.execute(
            f"UPDATE shop_items SET preview = '{css}' WHERE id = '{item_id}'"
        )


def downgrade() -> None:
    for item_id, emoji in ANTERIORES.items():
        op.execute(
            f"UPDATE shop_items SET preview = '{emoji}' WHERE id = '{item_id}'"
        )
