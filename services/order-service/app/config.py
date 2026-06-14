from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int = 5432
    order_db_name: str

    catalog_service_url: str = "http://catalog-service:8000"

    kafka_bootstrap_servers: str = "kafka:9092"
    order_events_topic: str = "order.created"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            "postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.order_db_name}"
        )


settings = Settings()
