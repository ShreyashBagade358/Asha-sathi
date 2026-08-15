#!/usr/bin/env bash
# =============================================================================
# ASHA Sathi - run Alembic migrations
# -----------------------------------------------------------------------------
# Applies all pending migrations on the backend database.
#
# Usage:
#   DATABASE_URL="postgresql+asyncpg://asha:asha_dev@localhost:5432/asha_sathi" \
#     ./scripts/db-migrate.sh
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"

# Default to the local dev database when not overridden
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://asha:asha_dev@localhost:5432/asha_sathi}"
export PYTHONPATH="$BACKEND_DIR"

cd "$BACKEND_DIR"

if ! command -v alembic >/dev/null 2>&1; then
  echo "alembic not found - installing dev requirements"
  python3 -m pip install --quiet -r requirements/base.txt -r requirements/dev.txt
fi

echo "==> Alembic current revision:"
alembic current

echo "==> Applying migrations (upgrade head)"
alembic upgrade head

echo "==> Done. Latest revision:"
alembic current
