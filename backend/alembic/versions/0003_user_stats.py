"""0003 — tabla user_stats para gamificacion

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_stats",
        sa.Column("id",                  sa.String(36),  nullable=False),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("xp_total",            sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("level",               sa.Integer(),   nullable=False, server_default="1"),
        sa.Column("streak_current",      sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("streak_max",          sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("sessions_completed",  sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("pomodoros_completed", sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("last_session_date",   sa.Date(),      nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_stats_user_id"),
    )
    op.create_index("ix_user_stats_user_id",  "user_stats", ["user_id"],  unique=True)
    op.create_index("ix_user_stats_xp_total", "user_stats", ["xp_total"], unique=False)


def downgrade() -> None:
    op.drop_table("user_stats")
