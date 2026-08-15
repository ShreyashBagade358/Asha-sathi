#!/usr/bin/env bash
# =============================================================================
# ASHA Sathi - database backup
# -----------------------------------------------------------------------------
# Dumps the PostgreSQL database with pg_dump into backups/<timestamp>.dump
# and optionally uploads it to S3-compatible storage via the AWS CLI.
#
# Usage:
#   ./scripts/backup.sh                          # local backup only
#   S3_BUCKET=s3://asha-sathi-backups ./scripts/backup.sh   # backup + upload
#
# Restore:
#   pg_restore --no-owner --clean -d asha_sathi backups/2026-08-12T033000Z.dump
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-asha}"
export PGPASSWORD="${PGPASSWORD:-asha_dev}"
export PGDATABASE="${PGDATABASE:-asha_sathi}"

RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILE="$BACKUP_DIR/asha_sathi_${TIMESTAMP}.dump"

info() { printf "\033[1;34m%s\033[0m %s\n" "✓" "$1"; }

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found. Install postgresql-client." >&2; exit 1; }

echo "==> Dumping $PGDATABASE@$PGHOST:$PGPORT"
pg_dump --format=custom --compress=9 --verbose \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  -f "$FILE"

ls -lh "$FILE"
info "Backup written to $FILE"

# --- Optional S3 upload ------------------------------------------------------
# Enable by exporting S3_BUCKET, e.g. S3_BUCKET=s3://asha-sathi-backups
# AWS CLI must be installed and configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
if [ -n "${S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    S3_PATH="${S3_BUCKET%/}/${PGDATABASE}_${TIMESTAMP}.dump"
    echo "==> Uploading to $S3_PATH"
    aws s3 cp "$FILE" "$S3_PATH"
    info "Upload complete"
  else
    echo "!! S3_BUCKET set but 'aws' CLI not found - skipping upload" >&2
  fi
fi

# --- Retention ---------------------------------------------------------------
echo "==> Pruning backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'asha_sathi_*.dump' -mtime "+$RETENTION_DAYS" -delete

info "Backup complete"
