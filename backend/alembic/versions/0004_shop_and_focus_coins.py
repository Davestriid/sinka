"""0004 — focus_coins en user_stats + tablas shop_items y user_inventory

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Agregar focus_coins a user_stats
    op.add_column(
        "user_stats",
        sa.Column("focus_coins", sa.Integer(), nullable=False, server_default="0"),
    )

    # 2. Tabla de ítems de la tienda
    op.create_table(
        "shop_items",
        sa.Column("id",          sa.String(36),  nullable=False),
        sa.Column("name",        sa.String(100), nullable=False),
        sa.Column("description", sa.String(300), nullable=False, server_default=""),
        sa.Column("category",    sa.String(30),  nullable=False),
        sa.Column("price_fc",    sa.Integer(),   nullable=False),
        sa.Column("preview",     sa.String(200), nullable=False, server_default=""),
        sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. Tabla de inventario del usuario
    op.create_table(
        "user_inventory",
        sa.Column("id",      sa.String(36), nullable=False),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            sa.String(36),
            sa.ForeignKey("shop_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "purchased_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "item_id", name="uq_user_inventory_user_item"),
    )
    op.create_index("ix_user_inventory_user_id", "user_inventory", ["user_id"])

    # 4. Seed data — catálogo inicial de la tienda
    op.execute("""
        INSERT INTO shop_items (id, name, description, category, price_fc, preview, is_active) VALUES
        ('item-bg-lofi-01',    'Lofi Café',          'Fondo de escritorio estilo café lofi', 'background',  30, '☕',  true),
        ('item-bg-forest-01',  'Bosque Digital',      'Fondo de bosque con neblina',          'background',  30, '🌲',  true),
        ('item-bg-space-01',   'Cosmos',              'Fondo espacial con nebulosas',          'background',  50, '🌌',  true),
        ('item-plant-cherry',  'Cerezo',              'Skin de planta sakura',                'plant_skin',  40, '🌸',  true),
        ('item-plant-cactus',  'Cactus Neon',         'Skin de cactus con brillo neón',       'plant_skin',  40, '🌵',  true),
        ('item-plant-bonsai',  'Bonsai Zen',          'Skin de bonsai minimalista',           'plant_skin',  60, '🎍',  true),
        ('item-frame-gold',    'Marco Dorado',        'Marco de avatar dorado',               'avatar_frame', 25, '🥇',  true),
        ('item-frame-fire',    'Marco Llamas',        'Marco animado de fuego (racha ≥ 7d)',  'avatar_frame', 80, '🔥',  true),
        ('item-music-rain',    'Rain Sounds',         'Pista de lluvia para concentración',   'music',       20, '🌧️',  true),
        ('item-music-lofi',    'Lofi Hip Hop',        'Playlist lofi curada',                'music',       20, '🎵',  true)
    """)


def downgrade() -> None:
    op.drop_table("user_inventory")
    op.drop_table("shop_items")
    op.drop_column("user_stats", "focus_coins")
