# KitobHub

KitobHub is a microservices-based online bookstore project built for learning and portfolio purposes.

The project demonstrates how a real-world backend system can be structured with separate services, databases, cache, message broker, API gateway, frontend, and worker processes.

## Features

* Catalog service for managing books, authors, and categories
* Order service for creating and listing orders
* Stock decrease flow when an order is created
* Redis cache for catalog book queries
* Kafka event publishing with `order.created`
* Notification worker consuming Kafka events
* NGINX API Gateway
* React + TypeScript frontend
* Docker Compose based local development environment
* Smoke test script for checking the full stack

## Architecture

```text
Browser
  |
  | http://localhost:3000
  v
Frontend container
  |
  | http://localhost:8088/api
  v
NGINX API Gateway
  |
  |-- /api/books  -> catalog-service
  |-- /api/orders -> order-service
                    |
                    | publishes order.created
                    v
                  Kafka
                    |
                    v
            notification-worker
```

## Tech Stack

### Backend

* Python 3.12
* FastAPI
* SQLAlchemy
* Alembic
* PostgreSQL
* Redis
* Kafka
* confluent-kafka
* httpx

### Frontend

* React
* TypeScript
* Vite
* NGINX static hosting

### Infrastructure

* Docker
* Docker Compose
* NGINX API Gateway
* Kafka UI

## Services

| Service         |                   URL | Description      |
| --------------- | --------------------: | ---------------- |
| Frontend        | http://localhost:3000 | React frontend   |
| NGINX Gateway   | http://localhost:8088 | API gateway      |
| Catalog Service | http://localhost:8001 | Books API        |
| Order Service   | http://localhost:8002 | Orders API       |
| Kafka UI        | http://localhost:8080 | Kafka monitoring |
| PostgreSQL      |        localhost:5433 | Database         |
| Redis           |        localhost:6379 | Cache            |

## Quick Start

### 1. Start the full stack

```bash
docker compose up -d --build
```

### 2. Run database migrations

Catalog service:

```bash
docker compose exec catalog-service alembic upgrade head
```

Order service:

```bash
docker compose exec order-service alembic upgrade head
```

### 3. Open the application

```text
http://localhost:3000
```

## Smoke Test

Run the smoke test script:

```bash
./scripts/smoke-test.sh
```

Expected result:

```text
All smoke tests passed.
```

The smoke test checks containers, HTTP endpoints, frontend availability, and Kafka topic `order.created`.

## API Gateway Routes

### Health

```http
GET /health
GET /api/catalog/health
GET /api/order/health
```

### Books

```http
GET /api/books
GET /api/books/{book_id}
```

### Orders

```http
GET /api/orders
GET /api/orders/{order_id}
POST /api/orders
```

Example order request:

```json
{
  "customer_name": "Habibjon Kadirov",
  "customer_email": "habibjon@example.com",
  "note": "Frontend order test",
  "items": [
    {
      "book_id": 1,
      "quantity": 1
    }
  ]
}
```

## Kafka Event Flow

When an order is created:

1. `order-service` validates the book through `catalog-service`
2. `catalog-service` decreases book stock
3. `order-service` saves the order in `order_db`
4. `order-service` publishes an `order.created` event to Kafka
5. `notification-worker` consumes the event and logs it

Example worker log:

```text
Received order.created event: order_id=13 customer=Habibjon Kadirov total=150000.00 UZS
```

## Project Structure

```text
kitobhub/
├── docker-compose.yml
├── frontend/
├── infra/
│   └── nginx/
├── scripts/
│   └── smoke-test.sh
├── services/
│   ├── catalog-service/
│   ├── order-service/
│   └── tools-service/
└── workers/
    └── notification-worker/
```

## Current Status

Implemented:

* Monorepo structure
* Local Docker infrastructure
* Catalog service
* Order service
* Redis caching
* Kafka event flow
* Notification worker
* NGINX API Gateway
* React frontend
* Frontend Docker container
* Smoke test script

Planned improvements:

* Automated tests with pytest
* GitHub Actions CI
* Better order status workflow
* Authentication
* Payment simulation
* Real email notification integration
- Automated tests with pytest
- GitHub Actions CI
- Better order status workflow
- Authentication
- Payment simulation
- Real email notification integration
