from decimal import Decimal

import httpx
from pydantic import BaseModel

from app.config import settings


class CatalogBook(BaseModel):
    id: int
    title: str
    price: Decimal
    currency: str
    stock_quantity: int


class CatalogBookNotFoundError(Exception):
    pass


class CatalogServiceUnavailableError(Exception):
    pass


async def fetch_catalog_book(book_id: int) -> CatalogBook:
    url = f"{settings.catalog_service_url.rstrip('/')}/internal/books/{book_id}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        raise CatalogServiceUnavailableError(str(exc)) from exc

    if response.status_code == 404:
        raise CatalogBookNotFoundError(f"Book {book_id} not found")

    if not response.is_success:
        raise CatalogServiceUnavailableError(
            f"Catalog service returned {response.status_code}"
        )

    return CatalogBook.model_validate(response.json())
