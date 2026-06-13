from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str


app = FastAPI(
    title="KitobHub Catalog Service",
    description="Books, authors and categories management service",
    version="0.1.0",
)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="catalog-service")
