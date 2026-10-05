from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    app_env: str = "development"
    app_title: str = "SINKA API"
    app_version: str = "1.0.0"
    cors_origins: str = "http://localhost:3000"

    # Base de datos
    database_url: str

    # Redis
    redis_url: str

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # Stripe (compra de FocusCoins con dinero real)
    # Vacios por defecto: mientras no esten configuradas, el router de pagos
    # devuelve un error claro en vez de que el backend entero no arranque.
    # En modo de prueba usar las claves "sk_test_..." / "pk_test_..." / "whsec_..."
    # del dashboard de Stripe; para cobrar de verdad, las "sk_live_..." etc.
    stripe_secret_key:      str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret:  str = ""
    # A donde vuelve el usuario despues de pagar (o cancelar) en Stripe Checkout
    frontend_url: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
