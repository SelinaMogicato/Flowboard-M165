#!/usr/bin/env bash
set -euo pipefail

if [ -z "${MONGODB_URI:-}" ]; then
  echo "Error: MONGODB_URI is not set." >&2
  exit 1
fi

if [ -z "${MONGODB_DB:-}" ]; then
  echo "Error: MONGODB_DB is not set." >&2
  exit 1
fi

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="backups/flowboard_${TIMESTAMP}"

mkdir -p backups

echo "Starting backup of database '${MONGODB_DB}'..."

mongodump \
  --uri="${MONGODB_URI}" \
  --db="${MONGODB_DB}" \
  --out="${BACKUP_DIR}"

echo "Backup complete: ${BACKUP_DIR}"
