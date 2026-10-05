"""
Catalogo fijo de paquetes de FocusCoins comprables con dinero real.

Fijo en codigo, no en base de datos, por la misma razon que el catalogo de
logros: son pocos valores que cambian con el codigo (una nueva release),
no algo que un admin deba poder tocar en caliente. El precio en la tienda
de cosmeticos (shop_items) es distinto: esos SI se compran con FocusCoins,
no con dinero, y SI los edita el panel de administracion.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CoinPack:
    id: str
    nombre: str
    coins: int
    precio_centavos: int   # en USD, centavos (lo que pide Stripe)


COIN_PACKS: dict[str, CoinPack] = {
    p.id: p
    for p in [
        CoinPack(id="pack_chico",   nombre="Paquete chico",   coins=500,   precio_centavos=299),
        CoinPack(id="pack_medio",   nombre="Paquete medio",   coins=1200,  precio_centavos=599),
        CoinPack(id="pack_grande",  nombre="Paquete grande",  coins=3000,  precio_centavos=1299),
    ]
}


def obtener_pack(pack_id: str) -> CoinPack | None:
    return COIN_PACKS.get(pack_id)
