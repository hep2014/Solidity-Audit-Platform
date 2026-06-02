#!/usr/bin/env sh
set -e

echo "Waiting for database migrations..."
alembic upgrade head

echo "Starting backend API..."
exec "$@"