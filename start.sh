#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "[1/4] Checking Docker daemon..."
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop and run ./start.sh again."
  exit 1
fi

echo "[2/4] Starting MongoDB (docker compose)..."
docker compose up -d mongo

echo "[3/4] Waiting for MongoDB to become ready..."
for i in {1..30}; do
  if docker exec flowboard-mongo mongosh --quiet --eval "db.adminCommand({ ping: 1 })" >/dev/null 2>&1; then
    echo "MongoDB is ready."
    break
  fi

  if [ "$i" -eq 30 ]; then
    echo "MongoDB did not become ready in time. Check: docker logs flowboard-mongo"
    exit 1
  fi

  sleep 2
done

echo "[4/4] Starting Astro dev server..."
npm run dev
