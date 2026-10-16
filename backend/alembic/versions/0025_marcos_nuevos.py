"""0025 — catálogo de marcos de avatar nuevos (sakura, enredadera, cristal, tormenta)

Los dos marcos originales (dorado, fuego) pasaron de ser un halo de luz
(boxShadow) a una ilustración SVG real que se dibuja encima del avatar
(ver frontend/src/components/AvatarFrame.tsx). Esta migración solo agrega
catálogo nuevo — no toca columnas ni el mecanismo de equipar, que ya es
genérico desde la migración 0023.

Revision ID: 0025
Revises: 0024
Create Date: 2026-10-16
"""
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None

NUEVOS_IDS = (
    "item-frame-sakura",
    "item-frame-vine",
    "item-frame-crystal",
    "item-frame-storm",
)


def upgrade() -> None:
    op.execute("""
        INSERT INTO shop_items (id, name, description, category, price_fc, preview, is_active) VALUES
        ('item-frame-sakura',  'Marco Sakura',       'Pétalos de cerezo flotando alrededor del avatar', 'avatar_frame', 35, '🌸', true),
        ('item-frame-vine',    'Marco Enredadera',   'Vid con hojas que bordea el avatar',               'avatar_frame', 30, '🌿', true),
        ('item-frame-crystal', 'Marco Cristal',      'Esquirlas de cristal que laten con un brillo frío','avatar_frame', 60, '💎', true),
        ('item-frame-storm',   'Marco Tormenta',     'Rayos y nubes bajas alrededor del avatar',          'avatar_frame', 90, '⛈️', true)
    """)


def downgrade() -> None:
    placeholders = ", ".join(f"'{i}'" for i in NUEVOS_IDS)
    op.execute(f"DELETE FROM user_inventory WHERE item_id IN ({placeholders})")
    op.execute(f"DELETE FROM shop_items WHERE id IN ({placeholders})")
