"""0029 — catálogo de fondos nuevos (sakura, playa, lluvia, montaña, biblioteca)

Antes solo había 3 fondos (café, bosque, cosmos), cada uno con su propia
escena SVG ilustrada (ver frontend/src/components/PageBackground.tsx). Esta
migración amplía el catálogo a 8 en total — no toca columnas ni el mecanismo
de equipar, que ya es genérico desde la migración 0023. El `preview` sigue
siendo un degradado CSS (mismo formato que estableció la migración 0024),
usado como color de respaldo mientras carga la escena ilustrada real.

Revision ID: 0029
Revises: 0028
Create Date: 2026-10-16
"""
from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None

NUEVOS_IDS = (
    "item-bg-sakura",
    "item-bg-ocean",
    "item-bg-rain",
    "item-bg-mountain",
    "item-bg-library",
)


def upgrade() -> None:
    op.execute("""
        INSERT INTO shop_items (id, name, description, category, price_fc, preview, is_active) VALUES
        ('item-bg-sakura',   'Jardín de Cerezos',   'Pétalos de sakura cayendo sobre un cielo rosado',        'background', 40, 'linear-gradient(135deg, #f7d6e0, #c97ba0)', true),
        ('item-bg-ocean',    'Atardecer en Playa',  'Horizonte marino con el sol cayendo sobre el agua',       'background', 40, 'linear-gradient(135deg, #ff9a6c, #3d4b7a)', true),
        ('item-bg-rain',     'Lluvia en Ventana',   'Ciudad borrosa tras el cristal, con luz cálida de fondo', 'background', 50, 'linear-gradient(135deg, #1f2b45, #4a5a78)', true),
        ('item-bg-mountain', 'Montaña al Amanecer', 'Picos nevados bajo un cielo de amanecer',                 'background', 50, 'linear-gradient(135deg, #e8d6e0, #7d93b5)', true),
        ('item-bg-library',  'Biblioteca Cálida',   'Estanterías de libros bajo la luz de una lámpara',        'background', 60, 'linear-gradient(135deg, #3a2614, #8a6238)', true)
    """)


def downgrade() -> None:
    placeholders = ", ".join(f"'{i}'" for i in NUEVOS_IDS)
    op.execute(f"DELETE FROM user_inventory WHERE item_id IN ({placeholders})")
    op.execute(f"UPDATE users SET equipped_background_item_id = NULL WHERE equipped_background_item_id IN ({placeholders})")
    op.execute(f"DELETE FROM shop_items WHERE id IN ({placeholders})")
