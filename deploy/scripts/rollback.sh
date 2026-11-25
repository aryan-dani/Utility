#!/usr/bin/env bash
# Rollback to a previous image tag (SHA). Default: previous entry in state/history.
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/utility/app}"
STATE_DIR="${STATE_DIR:-/srv/utility/state}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/deploy/utility/compose.yml}"
ENV_FILE="${ENV_FILE:-/srv/utility/.env}"

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:18100/health}"

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

CURRENT=$(cat "$STATE_DIR/deployed" 2>/dev/null || echo "")
TARGET="${1:-}"
if [[ -z "$TARGET" && -f "$STATE_DIR/history" ]]; then
  TARGET=$(awk -v cur="$CURRENT" 'NF >= 1 && $3 != "rollback" && $1 != cur { last = $1 } END { print last }' "$STATE_DIR/history" || true)
fi
if [[ -z "$TARGET" ]]; then
  echo "Usage: rollback.sh <sha>"
  exit 1
fi

echo "[rollback] → $TARGET (blocking broken ${CURRENT:-none} until next push)"
if [[ -n "$CURRENT" ]]; then
  echo "$CURRENT" > "$STATE_DIR/blocked"
fi
export UTILITY_TAG="$TARGET"
export COMPOSE_PROJECT_NAME=utility
docker compose -f "$COMPOSE_FILE" up -d --no-build api worker scheduler

for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "$TARGET" > "$STATE_DIR/deployed"
    echo "$TARGET $(date -u +%Y-%m-%dT%H:%M:%SZ) rollback" >> "$STATE_DIR/history"
    echo "[rollback] ok"
    exit 0
  fi
  sleep 2
done

echo "[rollback] health still failing"
exit 1
