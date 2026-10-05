"""0016 — generalizar reports a "buzon" (reportes + feedback general)

reported_user_id pasa a ser opcional (un comentario general no reporta a
nadie) y se agrega "tipo" para distinguir reporte_usuario de queja/
sugerencia/otro. El CHECK de reported_user_id se valida en el service.

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("reports", "reported_user_id", nullable=True)
    op.add_column(
        "reports",
        sa.Column("tipo", sa.String(length=30), nullable=False, server_default="reporte_usuario"),
    )
    op.create_check_constraint(
        "ck_reports_tipo_valido",
        "reports",
        "tipo IN ('reporte_usuario', 'queja', 'sugerencia', 'otro')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_reports_tipo_valido", "reports", type_="check")
    op.drop_column("reports", "tipo")
    op.alter_column("reports", "reported_user_id", nullable=False)
