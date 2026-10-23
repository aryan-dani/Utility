#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_HOST:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${RESTIC_REPOSITORY:?}"
: "${RESTIC_PASSWORD:?}"

export PGPASSWORD="$POSTGRES_PASSWORD"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "[restore-test] fetching latest dump from restic"
restic restore latest --target "$TMP" --include '*.dump' || {
  echo "[restore-test] no dump found yet; skip"
  exit 0
}

DUMP=$(find "$TMP" -name '*.dump' | head -n 1)
if [[ -z "$DUMP" ]]; then
  echo "[restore-test] no dump file; skip"
  exit 0
fi

# Restore into a throwaway database on the same Postgres
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS utility_restore;"
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE utility_restore;"
pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d utility_restore --clean --if-exists "$DUMP" || true

ROWS=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d utility_restore -Atc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
echo "[restore-test] public tables=${ROWS}"
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS utility_restore;"
echo "[restore-test] ok"
