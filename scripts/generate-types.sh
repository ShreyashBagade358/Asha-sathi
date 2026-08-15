#!/usr/bin/env bash
# =============================================================================
# ASHA Sathi - generate typed clients from the backend OpenAPI spec
# -----------------------------------------------------------------------------
# The backend serves its OpenAPI JSON at GET /openapi.json. This script runs
# openapi-generator to emit:
#   * Dart clients into packages/generated/dart   (used by the Flutter apps)
#   * TypeScript clients into packages/generated/ts (used by web-dashboard)
#
# Prerequisites:
#   * backend running (or OPENAPI_JSON env pointing at a spec file)
#   * java (openapi-generator-cli requires a JRE)
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OPENAPI_SOURCE="${OPENAPI_SOURCE:-http://localhost:8000/openapi.json}"
GENERATOR_VERSION="${OPENAPI_GENERATOR_VERSION:-7.5.0}"
GENERATOR_JAR="${OPENAPI_GENERATOR_JAR:-$ROOT_DIR/.cache/openapi-generator-cli.jar}"
TMP_SPEC="${TMPDIR:-/tmp}/asha-sathi-openapi.json"

mkdir -p "$ROOT_DIR/.cache"

info() { printf "\033[1;34m%s\033[0m %s\n" "✓" "$1"; }
error() { printf "\033[1;31m%s\033[0m %s\n" "✗" "$1"; exit 1; }

# 1. Fetch the OpenAPI spec
if [[ "$OPENAPI_SOURCE" == http* ]]; then
  curl -fsSL "$OPENAPI_SOURCE" -o "$TMP_SPEC" || error "Could not fetch $OPENAPI_SOURCE (is the backend running?)"
else
  [ -f "$OPENAPI_SOURCE" ] || error "Spec file not found: $OPENAPI_SOURCE"
  cp "$OPENAPI_SOURCE" "$TMP_SPEC"
fi
info "OpenAPI spec downloaded from $OPENAPI_SOURCE"

# 2. Download the generator CLI (cached)
if [ ! -f "$GENERATOR_JAR" ]; then
  info "Downloading openapi-generator-cli $GENERATOR_VERSION"
  curl -fsSL "https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/$GENERATOR_VERSION/openapi-generator-cli-$GENERATOR_VERSION.jar" \
    -o "$GENERATOR_JAR"
fi

# 3. Emit Dart client
info "Generating Dart client -> packages/generated/dart"
java -jar "$GENERATOR_JAR" generate \
  -i "$TMP_SPEC" \
  -g dart \
  -o packages/generated/dart \
  --additional-properties=pubName=asha_sathi_api,useEnumExtension=true,libraryName=asha_sathi_api

# 4. Emit TypeScript client
info "Generating TypeScript client -> packages/generated/ts"
java -jar "$GENERATOR_JAR" generate \
  -i "$TMP_SPEC" \
  -g typescript-fetch \
  -o packages/generated/ts \
  --additional-properties=npmName=asha-sathi-api,useSingleRequestParameter=true

echo ""
echo "Generated clients are ready. Add them to your workspace dependencies:"
echo "  # pnpm-workspace.yaml / package.json (web-dashboard)"
echo "  # pubspec.yaml                       (mobile apps -> path: ../../packages/generated/dart)"
