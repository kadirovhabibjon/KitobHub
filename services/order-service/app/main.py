from typing import Literal

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

from app.database import check_database_connection


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    database: Literal["ok"]


app = FastAPI(
    title="KitobHub Order Service",
    description="Orders and checkout management service",
    version="0.1.0",
)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    database_is_connected = check_database_connection()

    if not database_is_connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "service": "order-service",
                "database": "unavailable",
            },
        )

    return HealthResponse(
        status="ok",
        service="order-service",
        database="ok",
    )
