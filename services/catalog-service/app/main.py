from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.cache import (
    build_book_detail_cache_key,
    build_books_list_cache_key,
    check_redis_connection,
    get_json_cache,
    invalidate_books_cache,
    set_json_cache,
)
from app.crud import (
    book_to_response,
    create_book,
    decrease_book_stock,
    delete_book,
    get_book,
    internal_book_to_response,
    list_books,
    update_book,
)
from app.database import check_database_connection, get_db
from app.security import require_admin
from app.schemas import (
    BookCreate,
    BookListResponse,
    BookResponse,
    BookUpdate,
    InternalBookResponse,
    StockDecreaseRequest,
)


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    database: Literal["ok"]
    cache: Literal["ok"]


app = FastAPI(
    title="KitobHub Catalog Service",
    description="Books, authors and categories management service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    database_is_connected = check_database_connection()
    cache_is_connected = check_redis_connection()

    if not database_is_connected or not cache_is_connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "service": "catalog-service",
                "database": "ok" if database_is_connected else "unavailable",
                "cache": "ok" if cache_is_connected else "unavailable",
            },
        )

    return HealthResponse(
        status="ok",
        service="catalog-service",
        database="ok",
        cache="ok",
    )


@app.get("/books", response_model=BookListResponse)
def get_books(
    response: Response,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> BookListResponse:
    cache_key = build_books_list_cache_key(search)
    cached_payload = get_json_cache(cache_key)

    if cached_payload is not None:
        response.headers["X-Cache"] = "HIT"
        return BookListResponse.model_validate(cached_payload)

    books = list_books(db=db, search=search)
    items = [book_to_response(book) for book in books]
    payload = BookListResponse(items=items, total=len(items))

    set_json_cache(cache_key, payload.model_dump(mode="json"))
    response.headers["X-Cache"] = "MISS"

    return payload


@app.get("/books/{book_id}", response_model=BookResponse)
def get_book_by_id(
    book_id: int,
    response: Response,
    db: Session = Depends(get_db),
) -> BookResponse:
    cache_key = build_book_detail_cache_key(book_id)
    cached_payload = get_json_cache(cache_key)

    if cached_payload is not None:
        response.headers["X-Cache"] = "HIT"
        return BookResponse.model_validate(cached_payload)

    book = get_book(db=db, book_id=book_id)

    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Book not found"},
        )

    payload = book_to_response(book)
    set_json_cache(cache_key, payload.model_dump(mode="json"))
    response.headers["X-Cache"] = "MISS"

    return payload


@app.post("/books", response_model=BookResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_book_endpoint(
    data: BookCreate,
    db: Session = Depends(get_db),
) -> BookResponse:
    book = create_book(db=db, data=data)
    invalidate_books_cache(book_id=book.id)
    return book_to_response(book)


@app.put("/books/{book_id}", response_model=BookResponse, dependencies=[Depends(require_admin)])
def update_book_endpoint(
    book_id: int,
    data: BookUpdate,
    db: Session = Depends(get_db),
) -> BookResponse:
    book = get_book(db=db, book_id=book_id)

    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Book not found"},
        )

    updated_book = update_book(db=db, book=book, data=data)
    invalidate_books_cache(book_id=book_id)

    return book_to_response(updated_book)


@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_book_endpoint(
    book_id: int,
    db: Session = Depends(get_db),
) -> Response:
    book = get_book(db=db, book_id=book_id)

    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Book not found"},
        )

    delete_book(db=db, book=book)
    invalidate_books_cache(book_id=book_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/internal/books/{book_id}", response_model=InternalBookResponse)
def get_internal_book_by_id(
    book_id: int,
    db: Session = Depends(get_db),
) -> InternalBookResponse:
    book = get_book(db=db, book_id=book_id)

    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Book not found"},
        )

    return internal_book_to_response(book)


@app.post("/internal/books/{book_id}/decrease-stock", response_model=InternalBookResponse)
def decrease_internal_book_stock(
    book_id: int,
    data: StockDecreaseRequest,
    db: Session = Depends(get_db),
) -> InternalBookResponse:
    book = get_book(db=db, book_id=book_id)

    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Book not found"},
        )

    if book.stock_quantity < data.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Not enough stock",
                "book_id": book_id,
                "available": book.stock_quantity,
                "requested": data.quantity,
            },
        )

    updated_book = decrease_book_stock(
        db=db,
        book=book,
        quantity=data.quantity,
    )
    invalidate_books_cache(book_id=book_id)

    return internal_book_to_response(updated_book)


@app.get("/ads/active")
def get_active_ad(db: Session = Depends(get_db)) -> dict:
    ad = (
        db.execute(
            text(
                """
                SELECT
                    id,
                    title,
                    description,
                    badge,
                    video_url,
                    poster_url,
                    cta_label,
                    position,
                    is_active,
                    created_at,
                    updated_at
                FROM advertisements
                WHERE is_active = true
                ORDER BY id DESC
                LIMIT 1
                """
            )
        )
        .mappings()
        .first()
    )

    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Active advertisement not found"},
        )

    return dict(ad)


@app.put("/ads/active")
def update_active_ad(
    payload: dict,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
) -> dict:
    allowed_fields = {
        "title",
        "description",
        "badge",
        "video_url",
        "poster_url",
        "cta_label",
        "position",
        "is_active",
    }

    updates = {
        key: value
        for key, value in payload.items()
        if key in allowed_fields
    }

    if not updates:
        return get_active_ad(db)

    active_ad = get_active_ad(db)
    set_clause = ", ".join(f"{key} = :{key}" for key in updates)

    db.execute(
        text(
            f"""
            UPDATE advertisements
            SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = :ad_id
            """
        ),
        {**updates, "ad_id": active_ad["id"]},
    )
    db.commit()

    return get_active_ad(db)
