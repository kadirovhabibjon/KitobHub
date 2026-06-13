import hashlib
import json
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.config import settings


CACHE_TTL_SECONDS = 60

BOOKS_LIST_CACHE_PREFIX = "catalog:books:list"
BOOK_DETAIL_CACHE_PREFIX = "catalog:books:detail"


redis_client: Redis = Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    decode_responses=True,
)


def build_books_list_cache_key(search: str | None) -> str:
    normalized_search = (search or "").strip().lower()
    search_hash = hashlib.sha256(normalized_search.encode()).hexdigest()
    return f"{BOOKS_LIST_CACHE_PREFIX}:{search_hash}"


def build_book_detail_cache_key(book_id: int) -> str:
    return f"{BOOK_DETAIL_CACHE_PREFIX}:{book_id}"


def get_json_cache(key: str) -> dict[str, Any] | None:
    try:
        cached_value = redis_client.get(key)
        if cached_value is None:
            return None

        return json.loads(cached_value)
    except (RedisError, json.JSONDecodeError):
        return None


def set_json_cache(
    key: str,
    value: dict[str, Any],
    ttl_seconds: int = CACHE_TTL_SECONDS,
) -> None:
    try:
        redis_client.setex(
            name=key,
            time=ttl_seconds,
            value=json.dumps(value),
        )
    except RedisError:
        return


def delete_cache_by_pattern(pattern: str) -> None:
    try:
        keys = list(redis_client.scan_iter(match=pattern))
        if keys:
            redis_client.delete(*keys)
    except RedisError:
        return


def invalidate_books_cache(book_id: int | None = None) -> None:
    delete_cache_by_pattern(f"{BOOKS_LIST_CACHE_PREFIX}:*")

    if book_id is not None:
        redis_client.delete(build_book_detail_cache_key(book_id))


def check_redis_connection() -> bool:
    try:
        return bool(redis_client.ping())
    except RedisError:
        return False
