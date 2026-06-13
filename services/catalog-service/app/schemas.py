from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    price: Decimal = Field(gt=0)
    currency: str = Field(default="UZS", min_length=3, max_length=3)
    image_url: str | None = Field(default=None, max_length=500)
    stock_quantity: int = Field(default=0, ge=0)
    author_name: str = Field(min_length=1, max_length=255)
    category_name: str = Field(min_length=1, max_length=255)


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    image_url: str | None = Field(default=None, max_length=500)
    stock_quantity: int | None = Field(default=None, ge=0)
    author_name: str | None = Field(default=None, min_length=1, max_length=255)
    category_name: str | None = Field(default=None, min_length=1, max_length=255)


class BookResponse(BaseModel):
    id: int
    title: str
    description: str | None
    price: Decimal
    currency: str
    image_url: str | None
    stock_quantity: int
    author_id: int
    author_name: str
    category_id: int
    category_name: str

    model_config = ConfigDict(from_attributes=True)


class BookListResponse(BaseModel):
    items: list[BookResponse]
    total: int


class InternalBookResponse(BaseModel):
    id: int
    title: str
    price: Decimal
    currency: str
    stock_quantity: int

    model_config = ConfigDict(from_attributes=True)
