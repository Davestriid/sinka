"""0005 — perfil de usuario ampliado y categoria de actividad

Agrega a la tabla users los campos de perfil visible (alias, avatar, bio),
las preferencias de interfaz (idioma, tema) y el estado del onboarding.
Agrega tambien la categoria de actividad a matches y focus_sessions para
poder medir con que afinidad se conectaron dos personas.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Perfil visible ----------------------------------------------------
    op.add_column("users", sa.Column("alias", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(length=280), nullable=True))

    # --- Preferencias de interfaz -----------------------------------------
    op.add_column(
        "users",
        sa.Column("language", sa.String(length=5), nullable=False, server_default="es"),
    )
    op.add_column(
        "users",
        sa.Column("theme", sa.String(length=10), nullable=False, server_default="light"),
    )

    # --- Onboarding --------------------------------------------------------
    op.add_column("users", sa.Column("interests", sa.JSON(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Las cuentas que ya existian no pasaron por el onboarding nuevo, pero
    # tampoco conviene bloquearlas. Se marcan como completas y se les asigna
    # el username como alias inicial.
    op.execute(
        "UPDATE users SET onboarding_completed = true, alias = username "
        "WHERE alias IS NULL"
    )

    # --- Categoria de actividad en el emparejamiento -----------------------
    op.add_column("matches", sa.Column("topic", sa.String(length=30), nullable=True))
    op.add_column("focus_sessions", sa.Column("topic", sa.String(length=30), nullable=True))
    op.create_index("ix_matches_topic", "matches", ["topic"])


def downgrade() -> None:
    op.drop_index("ix_matches_topic", table_name="matches")
    op.drop_column("focus_sessions", "topic")
    op.drop_column("matches", "topic")

    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "interests")
    op.drop_column("users", "theme")
    op.drop_column("users", "language")
    op.drop_column("users", "bio")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "alias")
