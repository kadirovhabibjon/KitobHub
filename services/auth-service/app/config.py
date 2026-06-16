from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    auth_database_url: str = (
        "postgresql+psycopg://kitobhub:kitobhub@postgres:5432/auth_db"
    )
    jwt_secret: str = "kitobhub-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 1440

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
