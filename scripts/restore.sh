#!/usr/bin/env bash
# Usage: scripts/restore.sh backups/wordvault-XXXX.archive.gz [--drop]
# Without --drop, existing documents with the same _id are skipped (non-destructive merge).
# With --drop, each collection in the archive is dropped first (full replace) - asks for confirmation.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
FILE="${1:-}"; [ -f "$FILE" ] || { echo "Usage: $0 <archive.gz> [--drop]"; exit 1; }
URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/wordvault}"
command -v mongorestore >/dev/null || { echo "mongorestore not found. Install MongoDB Database Tools (see README)."; exit 1; }
ARGS=(--uri="$URI" --archive="$FILE" --gzip)
if [ "${2:-}" = "--drop" ]; then
  read -r -p "This will DROP and replace collections in the target database. Type YES to continue: " a
  [ "$a" = "YES" ] || { echo "Aborted."; exit 1; }
  ARGS+=(--drop)
fi
mongorestore "${ARGS[@]}"
echo "✔ Restore complete. Run: npm run db:init   (re-ensures indexes)"
