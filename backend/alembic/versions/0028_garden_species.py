"""0028 — especie compartida de la planta del jardín

Antes la "skin" de planta era puramente personal (equipped_plant_skin_item_id
en users, resuelta solo en el frontend de quien mira). Esta migración agrega
species_item_id a garden_plants: un valor que se asigna UNA SOLA VEZ cuando
nace la planta (al aceptar la amistad) y que es igual para los dos usuarios
del vínculo — así ambos ven el mismo tipo de planta que están cultivando
juntos, en vez de cada uno ver su propio skin personal encima.

Las plantas que ya existían se rellenan con una especie al azar del catálogo
activo de plant_skin, para que ningún jardín viejo quede sin especie.

Revision ID: 0028
Revises: 0027
Create Date: 2026-10-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "garden_plants",
        sa.Column("species_item_id", sa.String(36), nullable=True),
    )
    op.create_foreign_key(
        "fk_garden_plants_species_item_id_shop_items",
        "garden_plants", "shop_items",
        ["species_item_id"], ["id"],
        ondelete="SET NULL",
    )

    # Backfill: cada planta existente recibe una especie al azar del
    # catálogo activo de plant_skin, para que no se vean vacías.
    op.execute("""
        UPDATE garden_plants
        SET species_item_id = (
            SELECT id FROM shop_items
            WHERE category = 'plant_skin' AND is_active = true
            ORDER BY random()
            LIMIT 1
        )
        WHERE species_item_id IS NULL
    """)


def downgrade() -> None:
    op.drop_constraint(
        "fk_garden_plants_species_item_id_shop_items",
        "garden_plants", type_="foreignkey",
    )
    op.drop_column("garden_plants", "species_item_id")
