"""add order customer details

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-16
"""

from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("customer_phone", sa.String(length=50), nullable=True))
    op.add_column("orders", sa.Column("delivery_address", sa.Text(), nullable=True))
    op.add_column(
        "orders",
        sa.Column(
            "payment_method",
            sa.String(length=20),
            nullable=False,
            server_default="cash",
        ),
    )
    op.alter_column("orders", "payment_method", server_default=None)


def downgrade() -> None:
    op.drop_column("orders", "payment_method")
    op.drop_column("orders", "delivery_address")
    op.drop_column("orders", "customer_phone")
