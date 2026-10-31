#!/usr/bin/env bash
# Usage: scripts/backup.sh            -> backups/wordvault-YYYYmmdd-HHMMSS.archive.gz
# Reads MONGODB_URI from .env (or the environment). Requires `mongodump` (MongoDB Database Tools).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/wordvault}"
command -v mongodump >/dev/null || { echo "mongodump not found. Install MongoDB Database Tools (see README)."; exit 1; }
mkdir -p backups
OUT="backups/wordvault-$(date +%Y%m%d-%H%M%S).archive.gz"
mongodump --uri="$URI" --archive="$OUT" --gzip
echo "✔ Backup written to $OUT"
