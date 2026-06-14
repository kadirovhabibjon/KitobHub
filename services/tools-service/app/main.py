from decimal import Decimal

import httpx
from fastapi import FastAPI, HTTPException, Query

from app.config import settings


app = FastAPI(title="KitobHub Tools Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "tools-service",
    }


@app.get("/currency/rates")
async def get_currency_rate(
    currency: str = Query(default="USD", min_length=3, max_length=3),
) -> dict[str, str]:
    code = currency.upper()

    url = f"{settings.cbu_base_url}/{code}/"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Currency provider error: {exc}",
        ) from exc

    data = response.json()

    if not data:
        raise HTTPException(status_code=404, detail="Currency not found")

    item = data[0]
    rate = Decimal(str(item["Rate"]))

    return {
        "source": "Central Bank of Uzbekistan",
        "currency": item["Ccy"],
        "currency_name": item["CcyNm_EN"],
        "rate_to_uzs": str(rate),
        "date": item["Date"],
    }


@app.get("/weather/tashkent")
async def get_tashkent_weather() -> dict[str, object]:
    params = {
        "latitude": 41.3111,
        "longitude": 69.2797,
        "current": "temperature_2m,wind_speed_10m",
        "timezone": "Asia/Tashkent",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(settings.open_meteo_base_url, params=params)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Weather provider error: {exc}",
        ) from exc

    data = response.json()
    current = data.get("current", {})
    current_units = data.get("current_units", {})

    return {
        "source": "Open-Meteo",
        "city": "Tashkent",
        "temperature": current.get("temperature_2m"),
        "temperature_unit": current_units.get("temperature_2m"),
        "wind_speed": current.get("wind_speed_10m"),
        "wind_speed_unit": current_units.get("wind_speed_10m"),
        "time": current.get("time"),
    }
