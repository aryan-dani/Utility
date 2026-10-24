#!/usr/bin/env bash
# CI-gated deploy: fetch main, verify GitHub checks, build, migrate, up, health-gate.
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/utility/app}"
STATE_DIR="${STATE_DIR:-/srv/utility/state}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/deploy/utility/compose.yml}"
ENV_FILE="${ENV_FILE:-/srv/utility/.env}"
REPO_SLUG="${REPO_SLUG:-aryan-dani/Utility}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:18100/health/ready}"

mkdir -p "$STATE_DIR"
cd "$APP_DIR"

# Ensure repo exists
if [[ ! -d .git ]]; then
  echo "No git checkout at $APP_DIR — clone first:"
  echo "  git clone https://github.com/${REPO_SLUG}.git $APP_DIR"
  exit 1
fi

git fetch origin main --quiet
TARGET=$(git rev-parse origin/main)
CURRENT=$(cat "$STATE_DIR/deployed" 2>/dev/null || echo "")

if [[ "$TARGET" == "$CURRENT" ]]; then
  exit 0
fi

echo "[deploy] new sha=$TARGET (was ${CURRENT:-none})"

# Move working tree to the verified tip (fetch alone does not update files).
git checkout -q main 2>/dev/null || git checkout -q -B main "$TARGET"
git reset -q --hard "$TARGET"

# Unauthenticated GitHub checks API (public repo)
CHECKS_JSON=$(curl -fsS \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO_SLUG}/commits/${TARGET}/check-runs?per_page=20" || echo "")

if [[ -z "$CHECKS_JSON" ]]; then
  echo "[deploy] could not fetch check-runs; abort"
  exit 1
fi

# Require at least one completed success and zero failures
FAILED=$(echo "$CHECKS_JSON" | grep -c '"conclusion": "failure"' || true)
PENDING=$(echo "$CHECKS_JSON" | grep -c '"status": "in_progress\|"status": "queued"' || true)
SUCCESS=$(echo "$CHECKS_JSON" | grep -c '"conclusion": "success"' || true)

if [[ "$FAILED" -gt 0 ]]; then
  echo "[deploy] CI failed; skip"
  exit 0
fi
if [[ "$SUCCESS" -lt 1 || "$PENDING" -gt 0 ]]; then
  echo "[deploy] CI not green yet (success=$SUCCESS pending=$PENDING); skip"
  exit 0
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

export UTILITY_TAG="$TARGET"
export COMPOSE_PROJECT_NAME=utility

# Pre-deploy dump
if docker compose -f "$COMPOSE_FILE" ps postgres --status running >/dev/null 2>&1; then
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -Fc -U utility utility > "$STATE_DIR/pre-deploy-${STAMP}.dump" || true
fi

PREV="$CURRENT"
echo "$TARGET" > "$STATE_DIR/deploying"

docker compose -f "$COMPOSE_FILE" build api worker scheduler
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate
docker compose -f "$COMPOSE_FILE" up -d postgres api worker scheduler files gotenberg backup

ok=0
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "[deploy] health gate failed; rolling back to ${PREV:-none}"
  if [[ -n "$PREV" ]]; then
    UTILITY_TAG="$PREV" docker compose -f "$COMPOSE_FILE" up -d api worker scheduler
  fi
  exit 1
fi

echo "$TARGET" > "$STATE_DIR/deployed"
echo "$TARGET $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$STATE_DIR/history"
rm -f "$STATE_DIR/deploying"
echo "[deploy] success $TARGET"
