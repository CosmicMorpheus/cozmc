#!/usr/bin/env bash
# Back up, or restore, the account database (PostgreSQL custom format, which pg_restore reads).
#   DATABASE_URL=… scripts/db-backup.sh backup  [folder]            writes <folder>/cozmc-YYYYMMDD-HHMMSS.dump
#   DATABASE_URL=… scripts/db-backup.sh restore <file> --confirm    replaces the database's contents with that backup
# Back up before every migration and every launch switch change. Keep backups somewhere private: they hold
# wallet addresses and saves (never keys: the MainNet issuer key lives only in Netlify's secret settings).
# The URL is never printed.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the database to back up or restore.}"
case "${1:-}" in
  backup)
    dir="${2:-.}"; mkdir -p "$dir"
    file="$dir/cozmc-$(date -u +%Y%m%d-%H%M%S).dump"
    pg_dump --format=custom --no-owner --no-privileges --file="$file" "$DATABASE_URL"
    pg_restore --list "$file" > /dev/null          # the file is complete and readable
    echo "Backed up to $file ($(du -h "$file" | cut -f1))."
    ;;
  restore)
    file="${2:?Name the backup file to restore.}"
    [ "${3:-}" = "--confirm" ] || { echo "This replaces the database's current contents with $file. Run again with --confirm to go ahead."; exit 1; }
    pg_restore --list "$file" > /dev/null
    pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname="$DATABASE_URL" "$file"
    echo "Restored $file."
    ;;
  *) echo "Usage: scripts/db-backup.sh backup [folder] | restore <file> --confirm"; exit 1 ;;
esac
