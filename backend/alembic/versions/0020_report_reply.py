"""0020 — respuesta de admin a mensajes del buzon

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("admin_reply", sa.Text(), nullable=True))
    op.add_column(
        "reports", sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "reports",
        sa.Column("replied_by", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_reports_replied_by_users",
        "reports", "users",
        ["replied_by"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_reports_replied_by_users", "reports", type_="foreignkey")
    op.drop_column("reports", "replied_by")
    op.drop_column("reports", "replied_at")
    op.drop_column("reports", "admin_reply")
