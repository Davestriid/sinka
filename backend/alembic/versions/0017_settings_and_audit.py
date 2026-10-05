"""0017 — parametros configurables (settings) y auditoria de admin (audit_logs)

Siembra dos parametros reales usados por gamification_service
(fc_session_complete, xp_per_pomodoro) para que el panel de "Parametros"
no sea solo cosmetico: editarlos ahi cambia el otorgamiento de XP/FC.

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-05
"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "settings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("code", sa.String(length=60), nullable=False, unique=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_settings_code", "settings", ["code"])

    settings_table = sa.table(
        "settings",
        sa.column("id", sa.String),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("value", sa.JSON),
        sa.column("description", sa.Text),
    )
    op.bulk_insert(
        settings_table,
        [
            {
                "id": str(uuid.uuid4()),
                "code": "fc_session_complete",
                "name": "FocusCoins por sesion completada",
                "value": {"amount": 15},
                "description": (
                    "Cuantos FocusCoins recibe cada usuario al terminar una "
                    "sesion de enfoque (timer_completed). No incluye los "
                    "bonus de planta majestic ni de primera sesion del dia."
                ),
            },
            {
                "id": str(uuid.uuid4()),
                "code": "xp_per_pomodoro",
                "name": "XP por pomodoro completado",
                "value": {"amount": 100},
                "description": (
                    "XP base por cada pomodoro completado, antes de aplicar "
                    "el bonus de racha."
                ),
            },
        ],
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "admin_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("accion", sa.String(length=60), nullable=False),
        sa.Column("objetivo_tipo", sa.String(length=40), nullable=True),
        sa.Column("objetivo_id", sa.String(length=36), nullable=True),
        sa.Column("detalle", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_audit_logs_admin_id", "audit_logs", ["admin_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_admin_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_settings_code", table_name="settings")
    op.drop_table("settings")
