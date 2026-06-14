#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() {
  echo -e "${GREEN}✓${NC} $1"
}

fail() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

check_json_endpoint() {
  local name="$1"
  local url="$2"

  echo "Checking $name: $url"

  if curl -fsS "$url" >/tmp/kitobhub-smoke-response.json; then
    pass "$name"
  else
    fail "$name"
  fi
}

check_http_status() {
  local name="$1"
  local url="$2"
  local expected_status="$3"

  echo "Checking $name: $url"

  status_code="$(curl -s -o /dev/null -w "%{http_code}" "$url")"

  if [ "$status_code" = "$expected_status" ]; then
    pass "$name returned HTTP $expected_status"
  else
    echo "Expected: $expected_status"
    echo "Actual:   $status_code"
    fail "$name"
  fi
}

check_container_running() {
  local service="$1"

  echo "Checking container: $service"

  if docker compose ps "$service" --format json | grep -q '"State":"running"'; then
    pass "$service container is running"
  else
    docker compose ps "$service"
    fail "$service container is not running"
  fi
}

echo
echo "KitobHub smoke test started"
echo "=========================="
echo

check_container_running "postgres"
check_container_running "redis"
check_container_running "kafka"
check_container_running "catalog-service"
check_container_running "order-service"
check_container_running "nginx-gateway"
check_container_running "frontend"
check_container_running "notification-worker"

echo
echo "Checking HTTP endpoints"
echo "-----------------------"

check_json_endpoint "NGINX gateway health" "http://localhost:8088/health"
check_json_endpoint "Catalog health via gateway" "http://localhost:8088/api/catalog/health"
check_json_endpoint "Order health via gateway" "http://localhost:8088/api/order/health"
check_json_endpoint "Books API via gateway" "http://localhost:8088/api/books"
check_json_endpoint "Orders API via gateway" "http://localhost:8088/api/orders"
check_http_status "Frontend" "http://localhost:3000" "200"

echo
echo "Checking Kafka topic"
echo "--------------------"

if docker exec kitobhub-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka:9092 \
  --list | grep -q '^order.created$'; then
  pass "Kafka topic order.created exists"
else
  fail "Kafka topic order.created does not exist"
fi

echo
echo -e "${GREEN}All smoke tests passed.${NC}"
