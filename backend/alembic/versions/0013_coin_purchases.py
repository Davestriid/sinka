"""0013 — compras de FocusCoins con dinero real

Tabla coin_purchases: registra cada intento de compra iniciado en Stripe
Checkout y su estado final. El catalogo de paquetes (precio, cantidad de
coins) vive en codigo (modules/payments/catalog.py), no aqui.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coin_purchases",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("pack_id", sa.String(length=40), nullable=False),
        sa.Column("coins", sa.Integer(), nullable=False),
        sa.Column("precio_centavos", sa.Integer(), nullable=False),
        sa.Column("stripe_session_id", sa.String(length=255), nullable=False, unique=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'pagado', 'fallido')", name="ck_coin_purchases_estado_valido"
        ),
    )
    op.create_index("ix_coin_purchases_user_id", "coin_purchases", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_coin_purchases_user_id", table_name="coin_purchases")
    op.drop_table("coin_purchases")
