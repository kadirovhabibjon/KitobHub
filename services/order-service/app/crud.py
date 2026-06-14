from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.catalog_client import CatalogBook
from app.models import Order, OrderItem
from app.schemas import OrderCreate, OrderResponse


def get_order(db: Session, order_id: int) -> Order | None:
    statement = (
        select(Order)
        .where(Order.id == order_id)
        .options(joinedload(Order.items))
    )
    return db.scalar(statement)


def list_orders(db: Session) -> list[Order]:
    statement = (
        select(Order)
        .options(joinedload(Order.items))
        .order_by(Order.id.desc())
    )
    return list(db.scalars(statement).unique())


def order_to_response(order: Order) -> OrderResponse:
    return OrderResponse.model_validate(order)


def create_order_record(
    db: Session,
    data: OrderCreate,
    catalog_books: list[CatalogBook],
) -> Order:
    currency = catalog_books[0].currency
    total_amount = Decimal("0.00")

    order = Order(
        customer_name=data.customer_name.strip(),
        customer_email=data.customer_email,
        status="pending",
        total_amount=Decimal("0.00"),
        currency=currency,
        note=data.note,
    )

    db.add(order)
    db.flush()

    for item_data, catalog_book in zip(data.items, catalog_books, strict=True):
        line_total = catalog_book.price * item_data.quantity
        total_amount += line_total

        order_item = OrderItem(
            order_id=order.id,
            book_id=catalog_book.id,
            book_title=catalog_book.title,
            unit_price=catalog_book.price,
            quantity=item_data.quantity,
            line_total=line_total,
        )
        db.add(order_item)

    order.total_amount = total_amount

    db.commit()

    saved_order = get_order(db, order.id)
    if saved_order is None:
        raise RuntimeError("Created order was not found")

    return saved_order
