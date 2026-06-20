"""add advertisements table"""

from alembic import op
import sqlalchemy as sa


revision = "0003_add_advertisements_table"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "advertisements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("badge", sa.String(length=40), nullable=False, server_default="VIDEO AD"),
        sa.Column("video_url", sa.Text(), nullable=False),
        sa.Column("poster_url", sa.Text(), nullable=True),
        sa.Column("cta_label", sa.String(length=80), nullable=False, server_default="Book trailer"),
        sa.Column("position", sa.String(length=60), nullable=False, server_default="sidebar"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.execute("""
        INSERT INTO advertisements (
            title,
            description,
            badge,
            video_url,
            poster_url,
            cta_label,
            position,
            is_active
        )
        VALUES (
            'Kitob video reklamasi',
            'Yangi kelgan kitoblar uchun qisqa trailer yoki promo video shu joyda ko‘rsatiladi.',
            'VIDEO AD',
            'https://www.youtube-nocookie.com/embed/9P4ri-WCdDw?rel=0&modestbranding=1',
            'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80',
            'Book trailer',
            'sidebar',
            true
        )
    """)


def downgrade() -> None:
    op.drop_table("advertisements")
