from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import Author, Book, Category
from app.schemas import BookCreate, BookResponse, BookUpdate, InternalBookResponse


def _normalize_name(value: str) -> str:
    return value.strip()


def get_or_create_author(db: Session, name: str) -> Author:
    normalized_name = _normalize_name(name)

    author = db.scalar(select(Author).where(Author.name == normalized_name))
    if author is not None:
        return author

    author = Author(name=normalized_name)
    db.add(author)
    db.flush()
    return author


def get_or_create_category(db: Session, name: str) -> Category:
    normalized_name = _normalize_name(name)

    category = db.scalar(select(Category).where(Category.name == normalized_name))
    if category is not None:
        return category

    category = Category(name=normalized_name)
    db.add(category)
    db.flush()
    return category


def book_to_response(book: Book) -> BookResponse:
    return BookResponse(
        id=book.id,
        title=book.title,
        description=book.description,
        price=book.price,
        currency=book.currency,
        image_url=book.image_url,
        stock_quantity=book.stock_quantity,
        author_id=book.author_id,
        author_name=book.author.name,
        category_id=book.category_id,
        category_name=book.category.name,
    )


def internal_book_to_response(book: Book) -> InternalBookResponse:
    return InternalBookResponse(
        id=book.id,
        title=book.title,
        price=book.price,
        currency=book.currency,
        stock_quantity=book.stock_quantity,
    )


def list_books(db: Session, search: str | None = None) -> list[Book]:
    statement = select(Book).options(
        joinedload(Book.author),
        joinedload(Book.category),
    )

    if search:
        search_value = f"%{search.strip()}%"
        statement = (
            statement.join(Book.author)
            .join(Book.category)
            .where(
                or_(
                    Book.title.ilike(search_value),
                    Author.name.ilike(search_value),
                    Category.name.ilike(search_value),
                )
            )
        )

    statement = statement.order_by(Book.id.desc())
    return list(db.scalars(statement).unique())


def get_book(db: Session, book_id: int) -> Book | None:
    statement = (
        select(Book)
        .where(Book.id == book_id)
        .options(
            joinedload(Book.author),
            joinedload(Book.category),
        )
    )
    return db.scalar(statement)


def create_book(db: Session, data: BookCreate) -> Book:
    author = get_or_create_author(db, data.author_name)
    category = get_or_create_category(db, data.category_name)

    book = Book(
        title=data.title.strip(),
        description=data.description,
        price=data.price,
        currency=data.currency.upper(),
        image_url=data.image_url,
        stock_quantity=data.stock_quantity,
        author_id=author.id,
        category_id=category.id,
    )

    db.add(book)
    db.commit()
    db.refresh(book)

    return get_book(db, book.id) or book


def update_book(db: Session, book: Book, data: BookUpdate) -> Book:
    update_data = data.model_dump(exclude_unset=True)

    if "title" in update_data and update_data["title"] is not None:
        book.title = update_data["title"].strip()

    if "description" in update_data:
        book.description = update_data["description"]

    if "price" in update_data and update_data["price"] is not None:
        book.price = update_data["price"]

    if "currency" in update_data and update_data["currency"] is not None:
        book.currency = update_data["currency"].upper()

    if "image_url" in update_data:
        book.image_url = update_data["image_url"]

    if "stock_quantity" in update_data and update_data["stock_quantity"] is not None:
        book.stock_quantity = update_data["stock_quantity"]

    if "author_name" in update_data and update_data["author_name"] is not None:
        author = get_or_create_author(db, update_data["author_name"])
        book.author_id = author.id

    if "category_name" in update_data and update_data["category_name"] is not None:
        category = get_or_create_category(db, update_data["category_name"])
        book.category_id = category.id

    db.commit()
    db.refresh(book)

    return get_book(db, book.id) or book


def delete_book(db: Session, book: Book) -> None:
    db.delete(book)
    db.commit()
