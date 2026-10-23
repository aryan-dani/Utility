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

echo "[backup] pg_dump ${STAMP}"
pg_dump -Fc -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$DUMP"

if ! restic cat config >/dev/null 2>&1; then
  echo "[backup] initializing restic repo"
  restic init
fi

# Prefer Postgres + converted PDFs; skip raw mirror if over ~8GB total
INCLUDE=("$DUMP")
if [[ -d "$FILES_ROOT/r" ]]; then
  SIZE_KB=$(du -sk "$FILES_ROOT" 2>/dev/null | awk '{print $1}')
  if [[ "${SIZE_KB:-0}" -lt 8388608 ]]; then
    INCLUDE+=("$FILES_ROOT")
  else
    echo "[backup] files volume large (${SIZE_KB}KB); backing up PDFs only"
    # shellcheck disable=SC2207
    PDFS=($(find "$FILES_ROOT" -type f -name '*.pdf' 2>/dev/null | head -n 50000))
    INCLUDE+=("${PDFS[@]:-}")
  fi
fi

restic backup "${INCLUDE[@]}" --tag utility --host kuro-server
restic forget --keep-daily 14 --prune

rm -f "$DUMP"

if [[ -n "${HEALTHCHECKS_BACKUP_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_BACKUP_URL" >/dev/null || true
fi

echo "[backup] done ${STAMP}"
