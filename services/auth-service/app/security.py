from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import os
from typing import Any

import jwt
from jwt import InvalidTokenError

from app.config import settings


PASSWORD_HASH_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )

    return (
        f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}$"
        f"{salt.hex()}${password_hash.hex()}"
    )


def verify_password(password: str, stored_password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, hash_hex = stored_password_hash.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    calculated_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        int(iterations),
    ).hex()

    return hmac.compare_digest(calculated_hash, hash_hex)


def create_access_token(subject: str, role: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.jwt_expires_minutes,
    )

    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except InvalidTokenError:
        return None

    return payload
