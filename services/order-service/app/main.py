from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.catalog_client import (
    CatalogBook,
    CatalogBookNotFoundError,
    CatalogInsufficientStockError,
    CatalogServiceUnavailableError,
    decrease_catalog_book_stock,
    fetch_catalog_book,
)
from app.crud import create_order_record, get_order, list_orders, order_to_response, update_order_status
from app.database import check_database_connection, get_db
from app.events import EventPublishError, publish_order_created_event
from app.schemas import OrderCreate, OrderListResponse, OrderResponse, OrderStatusUpdate


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


@app.get("/orders", response_model=OrderListResponse)
def get_orders(db: Session = Depends(get_db)) -> OrderListResponse:
    orders = list_orders(db)
    items = [order_to_response(order) for order in orders]
    return OrderListResponse(items=items, total=len(items))


@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_order_by_id(
    order_id: int,
    db: Session = Depends(get_db),
) -> OrderResponse:
    order = get_order(db=db, order_id=order_id)

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Order not found"},
        )

    return order_to_response(order)


@app.put("/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status_endpoint(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
) -> OrderResponse:
    try:
        order = update_order_status(
            db=db,
            order_id=order_id,
            new_status=data.status,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(exc)},
        ) from exc

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Order not found"},
        )

    return order_to_response(order)


@app.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order_endpoint(
    data: OrderCreate,
    db: Session = Depends(get_db),
) -> OrderResponse:
    catalog_books: list[CatalogBook] = []

    for item in data.items:
        try:
            catalog_book = await fetch_catalog_book(item.book_id)
        except CatalogBookNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": f"Book {item.book_id} not found"},
            )
        except CatalogServiceUnavailableError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"message": "Catalog service is unavailable"},
            )

        if catalog_book.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Not enough stock",
                    "book_id": item.book_id,
                    "available": catalog_book.stock_quantity,
                    "requested": item.quantity,
                },
            )

        catalog_books.append(catalog_book)

    currencies = {book.currency for book in catalog_books}
    if len(currencies) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Order items must use the same currency"},
        )

    for item in data.items:
        try:
            await decrease_catalog_book_stock(
                book_id=item.book_id,
                quantity=item.quantity,
            )
        except CatalogBookNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": f"Book {item.book_id} not found"},
            )
        except CatalogInsufficientStockError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Not enough stock",
                    "book_id": exc.book_id,
                    "available": exc.available,
                    "requested": exc.requested,
                },
            )
        except CatalogServiceUnavailableError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"message": "Catalog service is unavailable"},
            )

    order = create_order_record(
        db=db,
        data=data,
        catalog_books=catalog_books,
    )
    response = order_to_response(order)

    try:
        publish_order_created_event(response)
    except EventPublishError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": "Order event could not be published"},
        )

    return response
