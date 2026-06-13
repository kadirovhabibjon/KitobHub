"""create catalog tables

Revision ID: 0001
Revises:
Create Date: 2026-06-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "authors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("name", name="uq_authors_name"),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("name", name="uq_categories_name"),
    )

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="UZS", nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["authors.id"],
            name="fk_books_author_id_authors",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name="fk_books_category_id_categories",
            ondelete="RESTRICT",
        ),
    )

    op.create_index("ix_books_title", "books", ["title"])
    op.create_index("ix_books_author_id", "books", ["author_id"])
    op.create_index("ix_books_category_id", "books", ["category_id"])


def downgrade() -> None:
    op.drop_index("ix_books_category_id", table_name="books")
    op.drop_index("ix_books_author_id", table_name="books")
    op.drop_index("ix_books_title", table_name="books")
    op.drop_table("books")
    op.drop_table("categories")
    op.drop_table("authors")
