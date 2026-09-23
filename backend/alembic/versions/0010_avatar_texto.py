"""0010 — la foto de perfil pasa a texto largo

El campo aceptaba 500 caracteres, suficiente para una direccion web pero no
para una imagen cargada por la persona. Las fotos se guardan como datos
incrustados, que ocupan bastante mas, asi que el campo pasa a texto sin limite.

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "avatar_url",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    # Las fotos que no quepan en 500 caracteres se pierden al volver atras
    op.execute("UPDATE users SET avatar_url = NULL WHERE length(avatar_url) > 500")
    op.alter_column(
        "users",
        "avatar_url",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
