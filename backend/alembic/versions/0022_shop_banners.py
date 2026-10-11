"""0022 — tienda: nueva categoria "profile_banner"

Seis banners de perfil comprables con FocusCoins. El valor que va en
`preview` no es un emoji como en las demas categorias: es un fondo CSS
(color solido o degradado) que el frontend aplica directo como
`background` detras del avatar en /perfil/[userId].

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-10
"""
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

IDS = (
    "item-banner-amanecer", "item-banner-bosque", "item-banner-oceano",
    "item-banner-lavanda", "item-banner-fuego", "item-banner-oro",
)


def upgrade() -> None:
    op.execute("""
        INSERT INTO shop_items (id, name, description, category, price_fc, preview, is_active) VALUES
        ('item-banner-amanecer', 'Amanecer',  'Banner de perfil degradado amanecer', 'profile_banner', 30, 'linear-gradient(135deg, #ff9a76, #ffd36e)', true),
        ('item-banner-bosque',   'Bosque',    'Banner de perfil degradado bosque',   'profile_banner', 30, 'linear-gradient(135deg, #2f5d4e, #8bc98f)', true),
        ('item-banner-oceano',   'Océano',    'Banner de perfil degradado océano',   'profile_banner', 40, 'linear-gradient(135deg, #1b3a57, #4fa8d8)', true),
        ('item-banner-lavanda',  'Lavanda',   'Banner de perfil degradado lavanda',  'profile_banner', 40, 'linear-gradient(135deg, #6a5a8c, #c8a8e9)', true),
        ('item-banner-fuego',    'Fuego',     'Banner de perfil degradado fuego',    'profile_banner', 80, 'linear-gradient(135deg, #7a1f1f, #ff6b35)', true),
        ('item-banner-oro',      'Oro',       'Banner de perfil degradado dorado',   'profile_banner', 80, 'linear-gradient(135deg, #8a6d1f, #f2d675)', true)
    """)


def downgrade() -> None:
    ids_sql = ", ".join(f"'{i}'" for i in IDS)
    op.execute(f"DELETE FROM user_inventory WHERE item_id IN ({ids_sql})")
    op.execute(f"UPDATE users SET equipped_banner_item_id = NULL WHERE equipped_banner_item_id IN ({ids_sql})")
    op.execute(f"DELETE FROM shop_items WHERE id IN ({ids_sql})")
