"""0009 — puntaje de confianza y registro de abandonos

El puntaje refleja que tan confiable es alguien para completar las sesiones a
las que se compromete. Nunca bloquea el acceso; solo influye en la prioridad
del emparejamiento.

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_stats",
        sa.Column("trust_score", sa.Integer(), nullable=False, server_default="100"),
    )
    op.add_column(
        "user_stats",
        sa.Column("sessions_abandoned", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "session_penalties",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("severity", sa.String(length=10), nullable=False, server_default="normal"),
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minutes_elapsed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_session_penalties_user_id", "session_penalties", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_session_penalties_user_id", table_name="session_penalties")
    op.drop_table("session_penalties")
    op.drop_column("user_stats", "sessions_abandoned")
    op.drop_column("user_stats", "trust_score")
