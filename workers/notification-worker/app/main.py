import json
import logging
import signal
from typing import Any

from confluent_kafka import Consumer, KafkaException

from app.config import settings


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [notification-worker] %(message)s",
)

logger = logging.getLogger(__name__)
is_running = True


def stop_worker(signum, frame) -> None:
    global is_running
    is_running = False


def handle_order_created_event(payload: dict[str, Any]) -> None:
    order = payload.get("order", {})
    logger.info(
        "Received order.created event: order_id=%s customer=%s total=%s %s",
        order.get("id"),
        order.get("customer_name"),
        order.get("total_amount"),
        order.get("currency"),
    )


def main() -> None:
    signal.signal(signal.SIGTERM, stop_worker)
    signal.signal(signal.SIGINT, stop_worker)

    consumer = Consumer(
        {
            "bootstrap.servers": settings.kafka_bootstrap_servers,
            "group.id": settings.notification_consumer_group,
            "auto.offset.reset": "earliest",
        }
    )

    consumer.subscribe([settings.order_events_topic])
    logger.info("Listening for Kafka topic: %s", settings.order_events_topic)

    try:
        while is_running:
            message = consumer.poll(timeout=1.0)

            if message is None:
                continue

            if message.error():
                raise KafkaException(message.error())

            payload = json.loads(message.value().decode("utf-8"))

            if payload.get("event_type") == "order.created":
                handle_order_created_event(payload)
            else:
                logger.info("Ignored event type: %s", payload.get("event_type"))
    finally:
        consumer.close()
        logger.info("Worker stopped")


if __name__ == "__main__":
    main()
