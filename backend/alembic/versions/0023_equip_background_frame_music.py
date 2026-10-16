"""0023 — equipar fondo, marco de avatar y musica de la tienda

Mismo mecanismo que equipped_banner_item_id (migracion 0021), pero para
las categorias "background", "avatar_frame" y "music" de shop_items, que
ahora si se aplican a algo real: el fondo del Dashboard, un anillo
alrededor del avatar en el NavBar, y pistas adicionales en el Pomodoro
en solitario respectivamente.

La categoria "plant_skin" se deja fuera a proposito: una planta es de un
vinculo entre dos personas, no de una sola, y todavia no hay una regla
de producto definida sobre de quien de los dos gana el skin equipado.

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None

COLUMNS = (
    "equipped_background_item_id",
    "equipped_avatar_frame_item_id",
    "equipped_music_item_id",
)


def upgrade() -> None:
    for col in COLUMNS:
        op.add_column("users", sa.Column(col, sa.String(length=36), nullable=True))
        op.create_foreign_key(
            f"fk_users_{col}_shop_items",
            "users", "shop_items",
            [col], ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    for col in COLUMNS:
        op.drop_constraint(f"fk_users_{col}_shop_items", "users", type_="foreignkey")
        op.drop_column("users", col)
