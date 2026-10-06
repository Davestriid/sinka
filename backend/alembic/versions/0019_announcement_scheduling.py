"""0019 — programacion opcional de anuncios (starts_at / expires_at)

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "announcements",
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "announcements",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("announcements", "expires_at")
    op.drop_column("announcements", "starts_at")
