from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PaymentMethod = Literal["cash", "card"]


class OrderItemCreate(BaseModel):
    book_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=255)
    customer_email: str | None = Field(default=None, max_length=255)
    customer_phone: str | None = Field(default=None, max_length=50)
    delivery_address: str | None = None
    payment_method: PaymentMethod = "cash"
    note: str | None = None
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderStatusUpdate(BaseModel):
    status: Literal["pending", "confirmed", "delivered", "cancelled"]


class OrderItemResponse(BaseModel):
    id: int
    book_id: int
    book_title: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: int
    customer_name: str
    customer_email: str | None
    customer_phone: str | None
    delivery_address: str | None
    payment_method: str
    status: str
    total_amount: Decimal
    currency: str
    note: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]

    model_config = ConfigDict(from_attributes=True)


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    total: int
