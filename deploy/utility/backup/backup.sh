#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_HOST:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_DB:?}"
: "${POSTGRES_PASSWORD:?}"
: "${RESTIC_REPOSITORY:?}"
: "${RESTIC_PASSWORD:?}"
: "${FILES_ROOT:=/data/files}"

export PGPASSWORD="$POSTGRES_PASSWORD"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="/backup/utility-${STAMP}.dump"
trap 'rm -f "$DUMP"' EXIT

echo "[backup] pg_dump ${STAMP}"
pg_dump -Fc -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$DUMP"

if ! restic cat config >/dev/null 2>&1; then
  echo "[backup] initializing restic repo"
  restic init
fi

# Prefer Postgres + converted PDFs/notes; skip raw mirror if over ~8GB total
INCLUDE=("$DUMP")
if [[ -d "$FILES_ROOT" ]]; then
  SIZE_KB=$(du -sk "$FILES_ROOT" 2>/dev/null | awk '{print $1}')
  if [[ "${SIZE_KB:-0}" -lt 8388608 ]]; then
    INCLUDE+=("$FILES_ROOT")
  else
    echo "[backup] files volume large (${SIZE_KB}KB); backing up PDFs and notes only"
    [[ -d "$FILES_ROOT/notes" ]] && INCLUDE+=("$FILES_ROOT/notes")
    mapfile -d '' PDFS < <(find "$FILES_ROOT" -type f -name '*.pdf' -print0 2>/dev/null)
    if [[ "${#PDFS[@]}" -gt 0 ]]; then
      INCLUDE+=("${PDFS[@]:0:50000}")
    fi
  fi
fi

restic backup "${INCLUDE[@]}" --tag utility --host kuro-server
restic forget --tag utility --keep-daily 14 --prune

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v stamp="$STAMP" -c \
  "INSERT INTO health_meta (key, value, updated_at) VALUES ('last_backup_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();" \
  >/dev/null 2>&1 || true

if [[ -n "${HEALTHCHECKS_BACKUP_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_BACKUP_URL" >/dev/null || true
fi

echo "[backup] done ${STAMP}"
