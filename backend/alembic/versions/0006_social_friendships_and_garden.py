"""0006 — modulo social: amistades, cuota diaria y jardin de vinculos

Crea las tablas que sostienen la capa social de SINKA. La amistad guarda el
par ordenado para que no existan dos filas describiendo la misma relacion al
reves. La planta cuelga de la amistad, asi que al deshacerla desaparece con ella.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Amistades ---------------------------------------------------------
    op.create_table(
        "friendships",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_low_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_high_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requester_id", sa.String(length=36), nullable=False),
        sa.Column("addressee_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("blocked_by_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_friendship_par"),
    )
    op.create_index("ix_friendships_user_low_id", "friendships", ["user_low_id"])
    op.create_index("ix_friendships_user_high_id", "friendships", ["user_high_id"])
    op.create_index("ix_friendships_status", "friendships", ["status"])

    # --- Jardin de vinculos ------------------------------------------------
    op.create_table(
        "garden_plants",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "friendship_id",
            sa.String(length=36),
            sa.ForeignKey("friendships.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("name", sa.String(length=60), nullable=True),
        sa.Column("phase", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("nourishment", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sessions_together", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minutes_together", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_watered_on", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_garden_plants_friendship_id", "garden_plants", ["friendship_id"])

    # --- Cuota diaria de solicitudes ---------------------------------------
    op.create_table(
        "friend_request_quotas",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quota_date", sa.Date(), nullable=False),
        sa.Column("used", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "quota_date", name="uq_cuota_usuario_dia"),
    )
    op.create_index("ix_friend_request_quotas_user_id", "friend_request_quotas", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_friend_request_quotas_user_id", table_name="friend_request_quotas")
    op.drop_table("friend_request_quotas")

    op.drop_index("ix_garden_plants_friendship_id", table_name="garden_plants")
    op.drop_table("garden_plants")

    op.drop_index("ix_friendships_status", table_name="friendships")
    op.drop_index("ix_friendships_user_high_id", table_name="friendships")
    op.drop_index("ix_friendships_user_low_id", table_name="friendships")
    op.drop_table("friendships")
