from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User
from app.schemas import UserRegister
from app.security import hash_password


def count_users(db: Session) -> int:
    return db.scalar(select(func.count(User.id))) or 0


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower().strip()))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, data: UserRegister) -> User:
    role = "admin" if count_users(db) == 0 else "customer"

    user = User(
        full_name=data.full_name.strip(),
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        role=role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user
