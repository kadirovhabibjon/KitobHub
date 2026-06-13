from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.crud import (
    book_to_response,
    create_book,
    delete_book,
    get_book,
    internal_book_to_response,
    list_books,
    update_book,
)
from app.database import check_database_connection, get_db
from app.schemas import (
    BookCreate,
    BookListResponse,
    BookResponse,
    BookUpdate,
    InternalBookResponse,
)


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    database: Literal["ok"]


app = FastAPI(
    title="KitobHub Catalog Service",
    description="Books, authors and categories management service",
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
                "service": "catalog-service",
                "database": "unavailable",
            },
        )

    return HealthResponse(
        status="ok",
        service="catalog-service",
        database="ok",
    )


@app.get("/books", response_model=BookListResponse)
def get_books(
    search: str | None = None,
    db: Session = Depends(get_db),
) -> BookListResponse:
    books = list_books(db=db, search=search)
    items = [book_to_response(book) for book in books]
    return BookListResponse(items=items, total=len(items))


@app.get("/books/{book_id}", response_model=BookResponse)
def get_book_by_id(
    book_id: int,
    db: Session = Depends(get_db),
) -> BookResponse:
    book = get_book(db=db, book_id=book_id)

    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Book not found"},
        )

    return book_to_response(book)


@app.post("/books", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book_endpoint(
    data: BookCreate,
    db: Session = Depends(get_db),
) -> BookResponse:
    book = create_book(db=db, data=data)
    return book_to_response(book)


@app.put("/books/{book_id}", response_model=BookResponse)
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
    return book_to_response(updated_book)


@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
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
