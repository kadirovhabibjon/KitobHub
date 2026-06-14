from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    kafka_bootstrap_servers: str = "kafka:9092"
    order_events_topic: str = "order.created"
    notification_consumer_group: str = "notification-worker"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
