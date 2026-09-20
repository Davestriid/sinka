"""0007 — grupos y miembros

Crea las tablas del modulo de grupos. El codigo de invitacion es unico para
poder buscar el grupo directamente por el, sin exponer su id interno.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=True),
        sa.Column("topic", sa.String(length=30), nullable=False),
        sa.Column("visibility", sa.String(length=10), nullable=False, server_default="public"),
        sa.Column("invite_code", sa.String(length=12), nullable=False, unique=True),
        sa.Column(
            "owner_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("default_task", sa.String(length=80), nullable=True),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default="8"),
        sa.Column(
            "open_to_strangers",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_groups_topic", "groups", ["topic"])
    op.create_index("ix_groups_owner_id", "groups", ["owner_id"])
    op.create_index("ix_groups_invite_code", "groups", ["invite_code"])
    op.create_index("ix_groups_visibility_topic", "groups", ["visibility", "topic"])

    op.create_table(
        "group_members",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "group_id",
            sa.String(length=36),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=10), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("group_id", "user_id", name="uq_miembro_grupo"),
    )
    op.create_index("ix_group_members_group_id", "group_members", ["group_id"])
    op.create_index("ix_group_members_user_id", "group_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_group_members_user_id", table_name="group_members")
    op.drop_index("ix_group_members_group_id", table_name="group_members")
    op.drop_table("group_members")

    op.drop_index("ix_groups_visibility_topic", table_name="groups")
    op.drop_index("ix_groups_invite_code", table_name="groups")
    op.drop_index("ix_groups_owner_id", table_name="groups")
    op.drop_index("ix_groups_topic", table_name="groups")
    op.drop_table("groups")
