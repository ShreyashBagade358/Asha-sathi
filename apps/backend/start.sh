#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head || echo "WARN: migration failed (continuing) - may be first boot or DB unreachable"

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
