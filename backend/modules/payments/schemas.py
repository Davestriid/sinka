from pydantic import BaseModel


class CoinPackResponse(BaseModel):
    id: str
    nombre: str
    coins: int
    precio_centavos: int


class CrearCheckoutRequest(BaseModel):
    pack_id: str


class CheckoutResponse(BaseModel):
    checkout_url: str
