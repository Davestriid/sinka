"""0030 — todas las pistas de música a la venta, salvo Lluvia (predeterminada)

Antes casi todas las pistas (Sakura, Bosque, Lluvia, Música, Pop) eran
gratuitas para cualquiera en el Pomodoro en solitario, y encima la tienda
tenía dos ítems de música que literalmente duplicaban dos de esas pistas ya
gratuitas (item-music-rain = Lluvia, item-music-lofi = Música) — se podía
"comprar" algo que ya tenías gratis.

Este cambio ordena eso: Lluvia pasa a ser la ÚNICA pista gratuita/predeterminada
(ver PISTAS en session/solo/page.tsx), y el resto (Sakura, Bosque, Pop, más la
Música que ya existía) quedan como ítems de música comprables en la tienda.
item-music-rain se desactiva — ya no tiene sentido venderla si ahora es la
que viene de fábrica.

Revision ID: 0030
Revises: 0029
Create Date: 2026-10-16
"""
from alembic import op

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None

NUEVOS_IDS = (
    "item-music-sakura",
    "item-music-bosque",
    "item-music-pop",
)


def upgrade() -> None:
    # Lluvia ya no se vende: ahora es la pista predeterminada gratuita.
    op.execute("UPDATE shop_items SET is_active = false WHERE id = 'item-music-rain'")

    op.execute("""
        INSERT INTO shop_items (id, name, description, category, price_fc, preview, is_active) VALUES
        ('item-music-sakura', 'Sakura',           'Pista ambiental suave, ideal para sesiones tranquilas', 'music', 20, '🌸', true),
        ('item-music-bosque', 'Bosque Tranquilo', 'Sonido ambiental de bosque para concentrarte',          'music', 20, '🌲', true),
        ('item-music-pop',    'Música Pop',       'Pista con más ritmo para sesiones activas',             'music', 20, '🎧', true)
    """)


def downgrade() -> None:
    op.execute("UPDATE shop_items SET is_active = true WHERE id = 'item-music-rain'")

    placeholders = ", ".join(f"'{i}'" for i in NUEVOS_IDS)
    op.execute(f"DELETE FROM user_inventory WHERE item_id IN ({placeholders})")
    op.execute(f"UPDATE users SET equipped_music_item_id = NULL WHERE equipped_music_item_id IN ({placeholders})")
    op.execute(f"DELETE FROM shop_items WHERE id IN ({placeholders})")
