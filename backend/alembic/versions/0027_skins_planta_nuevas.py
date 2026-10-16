"""0027 — catálogo de skins de planta nuevas (girasol, lavanda, palmera, loto, arce, cristal, luna)

Antes solo había 3 skins de planta (cerezo, cactus, bonsai). Esta migración
amplía el catálogo a 10 en total — no toca columnas ni el mecanismo de
equipar, que ya es genérico desde la migración 0026.

Revision ID: 0027
Revises: 0026
Create Date: 2026-10-16
"""
from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None

NUEVOS_IDS = (
    "item-plant-girasol",
    "item-plant-lavanda",
    "item-plant-palmera",
    "item-plant-loto",
    "item-plant-arce",
    "item-plant-cristal",
    "item-plant-luna",
)


def upgrade() -> None:
    op.execute("""
        INSERT INTO shop_items (id, name, description, category, price_fc, preview, is_active) VALUES
        ('item-plant-girasol', 'Girasol',       'Skin de girasol, siempre mirando al sol',            'plant_skin',  40,  '🌻', true),
        ('item-plant-lavanda', 'Lavanda',       'Skin de lavanda con flores moradas',                 'plant_skin',  40,  '💜', true),
        ('item-plant-palmera', 'Palmera',       'Skin de palmera tropical',                           'plant_skin',  50,  '🌴', true),
        ('item-plant-loto',    'Loto',          'Skin de flor de loto, calma y zen',                  'plant_skin',  60,  '🪷', true),
        ('item-plant-arce',    'Arce de otoño', 'Skin de arce con hojas rojizas',                     'plant_skin',  60,  '🍁', true),
        ('item-plant-cristal', 'Planta Cristal','Skin de planta hecha de cristal reluciente',         'plant_skin',  90,  '💎', true),
        ('item-plant-luna',    'Planta Lunar',  'Skin de planta que brilla tenue en la oscuridad',    'plant_skin',  100, '🌙', true)
    """)


def downgrade() -> None:
    # Nota: si 0028 (species_item_id en garden_plants) ya se aplicó, hay que
    # bajarla primero — su propio downgrade limpia las referencias a estos
    # ids antes de que esta migración los borre del catálogo.
    placeholders = ", ".join(f"'{i}'" for i in NUEVOS_IDS)
    op.execute(f"DELETE FROM user_inventory WHERE item_id IN ({placeholders})")
    op.execute(f"UPDATE users SET equipped_plant_skin_item_id = NULL WHERE equipped_plant_skin_item_id IN ({placeholders})")
    op.execute(f"DELETE FROM shop_items WHERE id IN ({placeholders})")
