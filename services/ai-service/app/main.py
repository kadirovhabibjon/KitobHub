import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


CATALOG_SERVICE_URL = os.getenv("CATALOG_SERVICE_URL", "http://catalog-service:8000")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

app = FastAPI(
    title="KitobHub AI Service",
    description="Local Ollama AI + real ML recommendation service",
    version="0.2.0",
)


class TextRequest(BaseModel):
    text: str = Field(..., min_length=2, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=1000)


def extract_books(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        for key in ("items", "results", "data", "books"):
            value = payload.get(key)
            if isinstance(value, list):
                return value

    return []


def get_book_id(book: dict[str, Any]) -> str:
    return str(book.get("id") or book.get("book_id") or "")


def get_book_text(book: dict[str, Any]) -> str:
    parts = [
        book.get("title"),
        book.get("name"),
        book.get("description"),
        book.get("summary"),
        book.get("category"),
        book.get("category_name"),
        book.get("author"),
        book.get("author_name"),
        book.get("language"),
    ]
    return " ".join(str(part) for part in parts if part).lower()


def clean_book(book: dict[str, Any], score: float | None = None) -> dict[str, Any]:
    data = {
        "id": book.get("id") or book.get("book_id"),
        "title": book.get("title") or book.get("name"),
        "author": book.get("author") or book.get("author_name"),
        "category": book.get("category") or book.get("category_name"),
        "description": book.get("description") or book.get("summary"),
        "price": book.get("price"),
        "currency": book.get("currency"),
    }

    if score is not None:
        data["similarity_score"] = round(float(score), 4)

    return data


async def fetch_books() -> list[dict[str, Any]]:
    urls = [
        f"{CATALOG_SERVICE_URL.rstrip('/')}/books",
        f"{CATALOG_SERVICE_URL.rstrip('/')}/api/books",
    ]

    last_error = None

    async with httpx.AsyncClient(timeout=10.0) as client:
        for url in urls:
            try:
                response = await client.get(url)
                response.raise_for_status()
                books = extract_books(response.json())

                if books:
                    return books
            except Exception as exc:
                last_error = exc

    raise HTTPException(
        status_code=502,
        detail=f"Catalog service’dan kitoblarni olishda xatolik: {last_error}",
    )


def recommend(
    books: list[dict[str, Any]],
    query_text: str,
    limit: int,
    exclude_id: str | None = None,
) -> list[dict[str, Any]]:
    valid_books = [book for book in books if get_book_text(book)]

    if len(valid_books) < 2:
        return []

    documents = [get_book_text(book) for book in valid_books]

    vectorizer = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),
        min_df=1,
    )

    book_vectors = vectorizer.fit_transform(documents)
    query_vector = vectorizer.transform([query_text.lower()])

    scores = cosine_similarity(query_vector, book_vectors).flatten()

    ranked = sorted(
        zip(valid_books, scores),
        key=lambda item: item[1],
        reverse=True,
    )

    result = []

    for book, score in ranked:
        if exclude_id and get_book_id(book) == str(exclude_id):
            continue

        if score < 0.12:
            continue

        result.append(clean_book(book, float(score)))

        if len(result) >= limit:
            break

    return result


def normalize_search_text(value: str | None) -> str:
    if not value:
        return ""

    value = value.lower()
    value = value.replace("‘", "'").replace("’", "'").replace("`", "'")
    value = re.sub(r"[^\w\s']", " ", value, flags=re.UNICODE)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def format_price(price: Any, currency: Any) -> str:
    if price is None:
        return "narx ko‘rsatilmagan"

    try:
        amount = float(price)
        formatted = f"{amount:,.0f}".replace(",", " ")
    except Exception:
        formatted = str(price)

    return f"{formatted} {currency or 'UZS'}"


def find_catalog_matches(message: str, books: list[dict[str, Any]]) -> list[dict[str, Any]]:
    message_norm = normalize_search_text(message)
    matches: list[dict[str, Any]] = []

    for book in books:
        title = book.get("title") or book.get("name")
        author = book.get("author") or book.get("author_name")

        title_norm = normalize_search_text(str(title or ""))
        author_norm = normalize_search_text(str(author or ""))

        if title_norm and title_norm in message_norm:
            matches.append(book)
            continue

        if author_norm and author_norm in message_norm:
            matches.append(book)
            continue

        # Masalan title ichida ikki probel bo'lsa ham topish uchun
        title_tokens = set(title_norm.split())
        message_tokens = set(message_norm.split())

        if len(title_tokens) >= 2:
            overlap = title_tokens & message_tokens
            ratio = len(overlap) / max(len(title_tokens), 1)

            if len(overlap) >= 2 and ratio >= 0.7:
                matches.append(book)

    unique: list[dict[str, Any]] = []
    seen = set()

    for book in matches:
        book_key = get_book_id(book)

        if book_key not in seen:
            seen.add(book_key)
            unique.append(book)

    return unique


def build_catalog_answer(message: str, matches: list[dict[str, Any]]) -> str:
    if not matches:
        return (
            "KitobHub bazasida bu so‘rovga mos aniq kitob topilmadi. "
            "Aniqroq kitob nomi, muallif yoki kategoriya yozsangiz, bazadagi ma’lumotlar asosida javob beraman."
        )

    if len(matches) == 1:
        book = matches[0]

        title = book.get("title") or book.get("name") or "Nomi ko‘rsatilmagan"
        author = book.get("author") or book.get("author_name") or "muallif ko‘rsatilmagan"
        category = book.get("category") or book.get("category_name") or "kategoriya ko‘rsatilmagan"
        description = book.get("description") or book.get("summary")
        stock = book.get("stock_quantity")

        description_text = description if description else "bu kitob uchun tavsif hozir bazada kiritilmagan"
        stock_text = f"{stock} ta" if stock is not None else "ko‘rsatilmagan"

        return (
            f"KitobHub bazasida “{title}” kitobi bor. "
            f"Muallif: {author}. "
            f"Kategoriya: {category}. "
            f"Narxi: {format_price(book.get('price'), book.get('currency'))}. "
            f"Omborda: {stock_text}. "
            f"Tavsif: {description_text}. "
            "Men bu javobni AI o‘ylab topgan ma’lumotdan emas, catalog database’dagi aniq ma’lumotlardan berdim."
        )

    lines = []

    for book in matches[:5]:
        title = book.get("title") or book.get("name") or "Nomi ko‘rsatilmagan"
        author = book.get("author") or book.get("author_name") or "muallif ko‘rsatilmagan"
        price = format_price(book.get("price"), book.get("currency"))
        lines.append(f"- {title} — {author}, {price}")

    return "KitobHub bazasida mos kitoblar topildi:\n" + "\n".join(lines)


async def ask_ollama(message: str, context_books: list[dict[str, Any]]) -> str:
    books_context = "\n".join(
        f"- {book.get('title')} | {book.get('description')} | {book.get('price')} {book.get('currency')}"
        for book in context_books[:5]
    )

    system_prompt = f"""
Sen KitobHub online kitob do‘koni uchun AI yordamchisan.
Sen local Ollama modeli orqali ishlayapsan.
Javobni o‘zbek tilida yoz.
Juda uzun yozma, 3-6 gap yetarli.
Agar user kitob tavsiya so‘rasa, quyidagi ML recommendation contextdan foydalan.

ML recommendation context:
{books_context}
""".strip()

    body = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat",
            json=body,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama local AI xatosi: {response.text}",
        )

    data = response.json()
    answer = data.get("message", {}).get("content")

    if not answer:
        raise HTTPException(
            status_code=502,
            detail="Ollama javob qaytardi, lekin text topilmadi.",
        )

    return answer.strip()


@app.get("/health")
async def health():
    return {
        "service": "ai-service",
        "status": "ok",
        "ai_provider": "ollama",
        "ai_model": OLLAMA_MODEL,
        "ml_model": "tf-idf + cosine-similarity",
    }


@app.get("/recommendations")
async def recommendations(
    book_id: str = Query(...),
    limit: int = Query(default=5, ge=1, le=20),
):
    books = await fetch_books()

    base_book = None

    for book in books:
        if get_book_id(book) == str(book_id):
            base_book = book
            break

    if not base_book:
        raise HTTPException(status_code=404, detail=f"Book id={book_id} topilmadi.")

    return {
        "model": "tf-idf + cosine-similarity",
        "base_book": clean_book(base_book),
        "recommendations": recommend(
            books=books,
            query_text=get_book_text(base_book),
            limit=limit,
            exclude_id=book_id,
        ),
    }


@app.post("/recommendations/by-text")
async def recommendations_by_text(payload: TextRequest):
    books = await fetch_books()

    return {
        "model": "tf-idf + cosine-similarity",
        "query": payload.text,
        "recommendations": recommend(
            books=books,
            query_text=payload.text,
            limit=payload.limit,
        ),
    }


@app.post("/chat")
async def chat(payload: ChatRequest):
    books = await fetch_books()

    exact_matches = find_catalog_matches(payload.message, books)

    if exact_matches:
        return {
            "model": "catalog-grounded + " + OLLAMA_MODEL,
            "type": "catalog-grounded-answer",
            "message": payload.message,
            "ml_context": [clean_book(book) for book in exact_matches[:5]],
            "answer": build_catalog_answer(payload.message, exact_matches),
        }

    context_books = recommend(
        books=books,
        query_text=payload.message,
        limit=5,
    )

    if not context_books:
        return {
            "model": "catalog-grounded + " + OLLAMA_MODEL,
            "type": "catalog-not-found",
            "message": payload.message,
            "ml_context": [],
            "answer": build_catalog_answer(payload.message, []),
        }

    answer = await ask_ollama(
        message=payload.message,
        context_books=context_books,
    )

    return {
        "model": OLLAMA_MODEL,
        "type": "local-ollama-ai-with-ml-context",
        "message": payload.message,
        "ml_context": context_books,
        "answer": answer,
    }
