"""0026 — equipped_plant_skin_item_id en users

La planta es de un VINCULO (amistad entre 2 personas), no de una sola, asi
que "equipar" un skin de planta no puede cambiar lo que la otra persona ve
— eso ya se decidio y documento en la migracion 0023. La resolucion: cada
usuario guarda su propio skin elegido, y el FRONTEND lo aplica solo sobre
lo que ESE usuario ve al dibujar la planta (fase y datos siguen siendo
100% del vinculo compartido, el skin es nada mas una piel visual local por
espectador). Mismo patron que equipped_background_item_id, etc.

Revision ID: 0026
Revises: 0025
Create Date: 2026-10-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("equipped_plant_skin_item_id", sa.String(36), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_equipped_plant_skin_item_id_shop_items",
        "users", "shop_items",
        ["equipped_plant_skin_item_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_equipped_plant_skin_item_id_shop_items", "users", type_="foreignkey")
    op.drop_column("users", "equipped_plant_skin_item_id")
