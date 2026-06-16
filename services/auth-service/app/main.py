from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.crud import create_user, get_user_by_email, get_user_by_id
from app.database import check_database_connection, get_db
from app.models import User
from app.schemas import AuthResponse, UserLogin, UserRegister, UserResponse
from app.security import create_access_token, decode_access_token, verify_password


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    database: Literal["ok"]


app = FastAPI(
    title="KitobHub Auth Service",
    description="Authentication and user management service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Authorization token is missing"},
        )

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid or expired token"},
        )

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid token subject"},
        )

    user = get_user_by_id(db=db, user_id=int(subject))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "User not found"},
        )

    return user


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    database_is_connected = check_database_connection()

    if not database_is_connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "service": "auth-service",
                "database": "unavailable",
            },
        )

    return HealthResponse(status="ok", service="auth-service", database="ok")


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    data: UserRegister,
    db: Session = Depends(get_db),
) -> AuthResponse:
    existing_user = get_user_by_email(db=db, email=data.email)

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Email already registered"},
        )

    user = create_user(db=db, data=data)
    token = create_access_token(subject=str(user.id), role=user.role)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@app.post("/auth/login", response_model=AuthResponse)
def login_user(
    data: UserLogin,
    db: Session = Depends(get_db),
) -> AuthResponse:
    user = get_user_by_email(db=db, email=data.email)

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid email or password"},
        )

    token = create_access_token(subject=str(user.id), role=user.role)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
