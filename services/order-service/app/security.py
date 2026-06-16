import os
from typing import Any

import jwt
from fastapi import Header, HTTPException, status
from jwt import InvalidTokenError


JWT_SECRET = os.getenv("JWT_SECRET", "kitobhub-dev-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


def decode_token(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Authorization token is missing"},
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid or expired token"},
        ) from exc


def require_admin(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    payload = decode_token(authorization)

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": "Admin role is required"},
        )

    return payload
