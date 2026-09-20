"""0008 — citas programadas y su cupo diario

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "appointments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "creator_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invitee_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "group_id",
            sa.String(length=36),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=80), nullable=True),
        sa.Column("topic", sa.String(length=30), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("status", sa.String(length=15), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("session_id", sa.String(length=36), nullable=True),
    )
    op.create_index("ix_appointments_creator_id", "appointments", ["creator_id"])
    op.create_index("ix_appointments_invitee_id", "appointments", ["invitee_id"])
    op.create_index("ix_appointments_group_id", "appointments", ["group_id"])
    op.create_index("ix_appointments_scheduled_for", "appointments", ["scheduled_for"])
    op.create_index("ix_appointments_status", "appointments", ["status"])

    op.create_table(
        "appointment_quotas",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quota_date", sa.Date(), nullable=False),
        sa.Column("used", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "quota_date", name="uq_cupo_citas_dia"),
    )
    op.create_index("ix_appointment_quotas_user_id", "appointment_quotas", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_appointment_quotas_user_id", table_name="appointment_quotas")
    op.drop_table("appointment_quotas")

    op.drop_index("ix_appointments_status", table_name="appointments")
    op.drop_index("ix_appointments_scheduled_for", table_name="appointments")
    op.drop_index("ix_appointments_group_id", table_name="appointments")
    op.drop_index("ix_appointments_invitee_id", table_name="appointments")
    op.drop_index("ix_appointments_creator_id", table_name="appointments")
    op.drop_table("appointments")
