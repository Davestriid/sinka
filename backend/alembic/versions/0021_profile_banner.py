"""0021 — banner de perfil (color propio + item equipado de la tienda)

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("banner_color", sa.String(length=9), nullable=True))
    op.add_column(
        "users",
        sa.Column("equipped_banner_item_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_equipped_banner_item_id_shop_items",
        "users", "shop_items",
        ["equipped_banner_item_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_users_equipped_banner_item_id_shop_items", "users", type_="foreignkey"
    )
    op.drop_column("users", "equipped_banner_item_id")
    op.drop_column("users", "banner_color")
