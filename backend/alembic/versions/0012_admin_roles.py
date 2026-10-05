"""0012 — roles de administracion

Agrega "role" (usuario/admin/superadmin) e "is_banned" a los usuarios, para
soportar el panel de administracion: quien puede entrar y que puede hacer.

No se crea una tabla de roles aparte porque solo hay tres valores fijos y
ningun otro dato cuelga de ellos — un string con constraint alcanza y evita
un join mas en cada chequeo de permisos.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="usuario"),
    )
    op.add_column(
        "users",
        sa.Column("is_banned", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_check_constraint(
        "ck_users_role_valido",
        "users",
        "role IN ('usuario', 'admin', 'superadmin')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_role_valido", "users", type_="check")
    op.drop_column("users", "is_banned")
    op.drop_column("users", "role")
