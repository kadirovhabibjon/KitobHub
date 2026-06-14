import json
from typing import Any

from confluent_kafka import Producer

from app.config import settings
from app.schemas import OrderResponse


producer = Producer(
    {
        "bootstrap.servers": settings.kafka_bootstrap_servers,
    }
)


class EventPublishError(Exception):
    pass


def publish_order_created_event(order: OrderResponse) -> None:
    payload: dict[str, Any] = {
        "event_type": "order.created",
        "order": order.model_dump(mode="json"),
    }

    errors: list[str] = []

    def delivery_report(error, message) -> None:
        if error is not None:
            errors.append(str(error))

    producer.produce(
        topic=settings.order_events_topic,
        key=str(order.id),
        value=json.dumps(payload),
        callback=delivery_report,
    )
    producer.flush(timeout=5)

    if errors:
        raise EventPublishError(errors[0])
