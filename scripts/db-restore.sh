#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Error: No backup path provided." >&2
  echo "Usage: npm run db:restore -- ./backups/flowboard_YYYY-MM-DD_HH-MM-SS" >&2
  exit 1
fi

BACKUP_PATH="$1"

if [ -z "${MONGODB_URI:-}" ]; then
  echo "Error: MONGODB_URI is not set." >&2
  exit 1
fi

if [ -z "${MONGODB_DB:-}" ]; then
  echo "Error: MONGODB_DB is not set." >&2
  exit 1
fi

if [ ! -d "${BACKUP_PATH}" ]; then
  echo "Error: Backup path '${BACKUP_PATH}' does not exist or is not a directory." >&2
  exit 1
fi

echo "Warning: This will replace the current '${MONGODB_DB}' database with the backup at '${BACKUP_PATH}'."
echo "The --drop flag is used, so all existing collections are dropped before the data is restored."
echo ""
echo "Restoring backup from '${BACKUP_PATH}'..."

mongorestore \
  --uri="${MONGODB_URI}" \
  --db="${MONGODB_DB}" \
  --drop \
  "${BACKUP_PATH}/${MONGODB_DB}"

echo "Restore complete. Database '${MONGODB_DB}' has been restored from '${BACKUP_PATH}'."
