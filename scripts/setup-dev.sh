#!/usr/bin/env bash
# =============================================================================
# ASHA Sathi - local development setup
# -----------------------------------------------------------------------------
# Checks prerequisites, installs dependencies, provisions .env files, starts
# the Postgres/Redis containers and applies database migrations.
#
# Usage:
#   chmod +x scripts/setup-dev.sh   # make executable (already executable-friendly)
#   ./scripts/setup-dev.sh
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PASS="✓"
FAIL="✗"

info()  { printf "\033[1;34m%s\033[0m %s\n" "$PASS" "$1"; }
warn()  { printf "\033[1;33m!\033[0m %s\n" "$1"; }
error() { printf "\033[1;31m%s\033[0m %s\n" "$FAIL" "$1"; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# --- Prerequisite checks -----------------------------------------------------
echo "==> Checking prerequisites"

have node || error "node not found. Install Node.js >= 20 (https://nodejs.org)"
have pnpm || error "pnpm not found. Install with: npm install -g pnpm@8.15.0"
have python3 || error "python3 not found"
have flutter || error "flutter not found. Install Flutter >= 3.22 (https://docs.flutter.dev)"
have docker || error "docker not found. Install Docker Desktop and start it"

NODE_VERSION="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js >= 20 required (found $(node -v))"
fi
info "node $(node -v)"

PY_VERSION="$(python3 --version 2>&1 | sed 's/Python //' | cut -d. -f1-2)"
MAJOR="$(echo "$PY_VERSION" | cut -d. -f1)"
MINOR="$(echo "$PY_VERSION" | cut -d. -f2)"
if [ "$MAJOR" -lt 3 ] || { [ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 11 ]; }; then
  error "Python >= 3.11 required (found $PY_VERSION)"
fi
info "python $PY_VERSION"

if ! docker info >/dev/null 2>&1; then
  error "Docker daemon is not running. Please start Docker Desktop."
fi
info "docker running"

# --- Workspace bootstrap -----------------------------------------------------
echo "==> Installing JS dependencies (pnpm)"
pnpm install

echo "==> Installing Python deps (backend)"
if have uv; then
  (cd apps/backend && uv pip install --system -r requirements/base.txt -r requirements/dev.txt)
else
  python3 -m pip install --quiet -r apps/backend/requirements/base.txt -r apps/backend/requirements/dev.txt
fi

echo "==> Flutter packages (all mobile apps)"
if have melos; then
  melos bootstrap
else
  for app in apps/mobile-asha apps/mobile-patient apps/mobile-phc-admin; do
    (cd "$app" && flutter pub get)
  done
fi

# --- .env provisioning -------------------------------------------------------
echo "==> Creating .env files from examples"
[ -f .env ] || { cp .env.example .env && info ".env created from .env.example"; }
for dir in apps/backend apps/ml-training apps/web-dashboard; do
  if [ -f "$dir/.env.example" ] && [ ! -f "$dir/.env" ]; then
    cp "$dir/.env.example" "$dir/.env"
    info "$dir/.env created"
  fi
done

# --- Containers --------------------------------------------------------------
echo "==> Starting Postgres + Redis"
docker compose -f docker/docker-compose.yml up -d postgres redis

echo "==> Waiting for Postgres to be healthy"
until docker exec asha-postgres pg_isready -U asha -d asha_sathi >/dev/null 2>&1; do
  sleep 2
done
info "Postgres healthy"

# --- Migrations --------------------------------------------------------------
echo "==> Applying database migrations"
(
  cd apps/backend
  export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://asha:asha_dev@localhost:5432/asha_sathi}"
  alembic upgrade head
)

echo ""
echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Seed demo data:        ./scripts/seed-data.sh"
echo "  2. Start the API:         cd apps/backend && uvicorn app.main:app --reload"
echo "  3. Start the dashboard:   cd apps/web-dashboard && pnpm dev"
echo "  4. Run the mobile app:    cd apps/mobile-asha && flutter run"
echo "  5. DB console (Adminer):  http://localhost:8081"
echo "  6. Optional Supabase:     docker compose --profile supabase up -d"
