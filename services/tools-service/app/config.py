from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cbu_base_url: str = "https://cbu.uz/ru/arkhiv-kursov-valyut/json"
    open_meteo_base_url: str = "https://api.open-meteo.com/v1/forecast"


settings = Settings()
