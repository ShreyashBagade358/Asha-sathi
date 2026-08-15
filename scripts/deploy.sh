#!/usr/bin/env bash
# =============================================================================
# ASHA Sathi - production compose deploy wrapper
# -----------------------------------------------------------------------------
# Builds, pushes and deploys the production compose stack on a single host.
#
# Required environment variables (exported or in .env):
#   DATABASE_URL, REDIS_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_KEY, JWT_SECRET, POSTGRES_PASSWORD
#
# Usage:
#   ./scripts/deploy.sh build push up     # build + push + roll out
#   ./scripts/deploy.sh up                # pull + roll out only
#   ./scripts/deploy.sh status            # show running services
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILES="-f docker/docker-compose.yml -f docker/docker-compose.prod.yml"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
export IMAGE_TAG

REQUIRED_ENV=(
  DATABASE_URL REDIS_URL SUPABASE_URL SUPABASE_ANON_KEY
  SUPABASE_SERVICE_KEY JWT_SECRET POSTGRES_PASSWORD
)

info() { printf "\033[1;34m%s\033[0m %s\n" "✓" "$1"; }
error() { printf "\033[1;31m%s\033[0m %s\n" "✗" "$1"; exit 1; }

# Load .env if present (never commit it!)
if [ -f .env ]; then
  set -a; source .env; set +a
fi

check_env() {
  local missing=0
  for var in "${REQUIRED_ENV[@]}"; do
    if [ -z "${!var:-}" ]; then
      echo "  Missing: $var"
      missing=1
    fi
  done
  [ "$missing" -eq 0 ] || error "Aborting: required environment variables missing"
}

# Docker context (default to local)
DOCKER_CONTEXT_NAME="${DOCKER_CONTEXT_NAME:-}"
if [ -n "$DOCKER_CONTEXT_NAME" ]; then
  docker context use "$DOCKER_CONTEXT_NAME" >/dev/null
  info "Using docker context: $DOCKER_CONTEXT_NAME"
fi

case "${1:-}" in
  build)
    check_env
    docker compose $COMPOSE_FILES build backend web-dashboard ml-serving
    ;;
  push)
    check_env
    docker push ghcr.io/yourorg/asha-sathi-backend:$IMAGE_TAG
    docker push ghcr.io/yourorg/asha-sathi-web-dashboard:$IMAGE_TAG
    docker push ghcr.io/yourorg/asha-sathi-ml-serving:$IMAGE_TAG
    ;;
  up)
    check_env
    docker compose $COMPOSE_FILES up -d --remove-orphans
    info "Stack deployed (image tag: $IMAGE_TAG)"
    ;;
  deploy)
    check_env
    docker compose $COMPOSE_FILES build backend web-dashboard ml-serving
    docker compose $COMPOSE_FILES up -d --remove-orphans
    info "Stack deployed (image tag: $IMAGE_TAG)"
    ;;
  status)
    docker compose $COMPOSE_FILES ps
    ;;
  logs)
    docker compose $COMPOSE_FILES logs -f --tail=200 "${2:-backend}"
    ;;
  rollback)
    # Roll back to the previously running image tag (requires IMAGE_TAG=<previous>).
    check_env
    docker compose $COMPOSE_FILES pull backend web-dashboard ml-serving
    docker compose $COMPOSE_FILES up -d --no-build
    info "Rolled back to image tag: $IMAGE_TAG"
    ;;
  *)
    echo "Usage: $0 {build|push|up|deploy|status|logs|rollback}"
    echo "  build    - build backend/web/ml images"
    echo "  push     - push images to the registry (ghcr.io)"
    echo "  up       - pull + start the stack"
    echo "  deploy   - build + start (single node, no registry push)"
    echo "  status   - show service status"
    echo "  logs     - tail logs (default: backend)"
    echo "  rollback - pull + restart using IMAGE_TAG=<previous>"
    exit 1
    ;;
esac
