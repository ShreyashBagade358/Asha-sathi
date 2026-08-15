#!/usr/bin/env bash
# =============================================================================
# ASHA Sathi - seed demo data
# -----------------------------------------------------------------------------
# Runs the backend seed module which populates a realistic Uttar Pradesh
# health-system hierarchy plus demo households, beneficiaries, pregnancies,
# children, NCD screenings, KPIs and notifications.
#
# Usage:
#   DATABASE_URL="postgresql+asyncpg://asha:asha_dev@localhost:5432/asha_sathi" \
#     ./scripts/seed-data.sh
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"

export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://asha:asha_dev@localhost:5432/asha_sathi}"
export PYTHONPATH="$BACKEND_DIR"

if [ "${SKIP_SEED_CHECK:-0}" != "1" ]; then
  read -r -p "This will insert demo records into the configured database. Continue? [y/N] " answer
  case "$answer" in
    y | Y | yes | YES) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

cd "$BACKEND_DIR"

if ! python3 -c "import sqlalchemy" 2>/dev/null; then
  echo "Installing backend dependencies..."
  python3 -m pip install --quiet -r requirements/base.txt
fi

echo "==> Seeding demo data"
python -m app.seed

echo "==> Seed complete"
