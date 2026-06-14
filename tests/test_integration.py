import json
import subprocess
import urllib.request


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=5) as response:
        assert response.status == 200
        return json.loads(response.read().decode("utf-8"))


def get_status(url: str) -> int:
    with urllib.request.urlopen(url, timeout=5) as response:
        return response.status


def test_gateway_health():
    data = get_json("http://localhost:8088/health")

    assert data["status"] == "ok"
    assert data["service"] == "nginx-gateway"


def test_catalog_health_via_gateway():
    data = get_json("http://localhost:8088/api/catalog/health")

    assert data["status"] == "ok"
    assert data["service"] == "catalog-service"
    assert data["database"] == "ok"
    assert data["cache"] == "ok"


def test_order_health_via_gateway():
    data = get_json("http://localhost:8088/api/order/health")

    assert data["status"] == "ok"
    assert data["service"] == "order-service"
    assert data["database"] == "ok"


def test_books_api_via_gateway():
    data = get_json("http://localhost:8088/api/books")

    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


def test_orders_api_via_gateway():
    data = get_json("http://localhost:8088/api/orders")

    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


def test_frontend_is_served():
    assert get_status("http://localhost:3000") == 200


def test_kafka_order_created_topic_exists():
    result = subprocess.run(
        [
            "docker",
            "exec",
            "kitobhub-kafka",
            "/opt/kafka/bin/kafka-topics.sh",
            "--bootstrap-server",
            "kafka:9092",
            "--list",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    topics = result.stdout.splitlines()

    assert "order.created" in topics
