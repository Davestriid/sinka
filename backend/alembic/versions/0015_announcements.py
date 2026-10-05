"""0015 — anuncios del panel de administracion

Tabla announcements: lo que antes era un placeholder (POST /admin/announcements
que no guardaba nada) ahora persiste aqui. El dashboard muestra el mas
reciente con activo=true como banner.

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("titulo", sa.String(length=120), nullable=False),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "creado_por_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("announcements")
