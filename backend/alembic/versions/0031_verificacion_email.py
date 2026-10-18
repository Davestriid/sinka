"""0031 — verificacion de correo por enlace

Agrega tres columnas a users para poder confirmar que el correo con el que
alguien se registro realmente existe y le pertenece:

  - email_verified: booleano informativo. NO bloquea el login — las cuentas
    ya existentes quedarian todas "sin verificar" de golpe si se usara para
    negar acceso, asi que por ahora solo se usa para mostrar el estado en el
    panel admin y recordarle al usuario que confirme.
  - email_verification_token: token de un solo uso (vuelve a NULL en cuanto
    se confirma, o al pedir uno nuevo).
  - email_verification_expires: vencimiento del token (24h desde que se
    genera, ver IdentityService).

Revision ID: 0031
Revises: 0030
Create Date: 2026-10-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("email_verification_token", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("email_verification_expires", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_email_verification_token", "users", ["email_verification_token"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_email_verification_token", "users", type_="unique")
    op.drop_column("users", "email_verification_expires")
    op.drop_column("users", "email_verification_token")
    op.drop_column("users", "email_verified")
