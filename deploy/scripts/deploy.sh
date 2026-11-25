#!/usr/bin/env bash
# CI-gated deploy: fetch main, verify GitHub checks, build, migrate, up, health-gate.
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/utility/app}"
STATE_DIR="${STATE_DIR:-/srv/utility/state}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/deploy/utility/compose.yml}"
ENV_FILE="${ENV_FILE:-/srv/utility/.env}"
REPO_SLUG="${REPO_SLUG:-aryan-dani/Utility}"
# Liveness only. /health/ready also fails when Drive sync is older than 2h, which must not roll back a code deploy.
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:18100/health}"

mkdir -p "$STATE_DIR"
cd "$APP_DIR"

exec 9>"$STATE_DIR/deploy.lock"
if ! flock -n 9; then
  exit 0
fi

# Ensure repo exists
if [[ ! -d .git ]]; then
  echo "No git checkout at $APP_DIR — clone first:"
  echo "  git clone https://github.com/${REPO_SLUG}.git $APP_DIR"
  exit 1
fi

git fetch origin main --quiet
TARGET=$(git rev-parse origin/main)
CURRENT=$(cat "$STATE_DIR/deployed" 2>/dev/null || echo "")
FAILED_SHA=$(cat "$STATE_DIR/failed" 2>/dev/null || echo "")
BLOCKED_SHA=$(cat "$STATE_DIR/blocked" 2>/dev/null || echo "")

if [[ "$TARGET" == "$CURRENT" || "$TARGET" == "$FAILED_SHA" || "$TARGET" == "$BLOCKED_SHA" ]]; then
  exit 0
fi

echo "[deploy] candidate sha=$TARGET (current ${CURRENT:-none})"

# Verify GitHub CI checks BEFORE checking out or executing code from $TARGET.
CHECKS_JSON=$(curl -fsS --max-time 15 \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO_SLUG}/commits/${TARGET}/check-runs?per_page=30" || echo "")

if [[ -z "$CHECKS_JSON" ]]; then
  echo "[deploy] could not fetch check-runs; abort"
  exit 1
fi

CI_VERDICT=$(python3 -c '
import json, sys
data = json.loads(sys.argv[1])
runs = data.get("check_runs") or []
pending = sum(1 for r in runs if r.get("status") in ("queued", "in_progress", "waiting", "requested"))
failed = sum(1 for r in runs if r.get("conclusion") in ("failure", "cancelled", "timed_out", "action_required"))
ci_ok = any(r.get("name") == "check" and r.get("conclusion") == "success" for r in runs)
if not ci_ok and runs:
    ci_ok = any(r.get("conclusion") == "success" for r in runs)
if failed > 0:
    print("failed")
elif pending > 0 or not ci_ok:
    print(f"pending:{pending}")
else:
    print("ok")
' "$CHECKS_JSON")

if [[ "$CI_VERDICT" == "failed" ]]; then
  echo "[deploy] CI failed for $TARGET; skip"
  exit 0
fi
if [[ "$CI_VERDICT" != "ok" ]]; then
  echo "[deploy] CI not green yet ($CI_VERDICT); skip"
  exit 0
fi

# Move working tree only after CI has verified $TARGET.
git checkout -q main 2>/dev/null || git checkout -q -B main "$TARGET"
git reset -q --hard "$TARGET"

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

export UTILITY_TAG="$TARGET"
export COMPOSE_PROJECT_NAME=utility

TMP_DUMP=""
cleanup_tmp() {
  if [[ -n "$TMP_DUMP" && -f "$TMP_DUMP" ]]; then
    rm -f "$TMP_DUMP"
  fi
}
trap cleanup_tmp EXIT

# Pre-deploy dump (atomic write + retain last 5)
if docker compose -f "$COMPOSE_FILE" ps postgres --status running >/dev/null 2>&1; then
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  TMP_DUMP="$STATE_DIR/.pre-deploy-${STAMP}.dump.tmp"
  if docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -Fc -U utility utility > "$TMP_DUMP" && [[ -s "$TMP_DUMP" ]]; then
    mv "$TMP_DUMP" "$STATE_DIR/pre-deploy-${STAMP}.dump"
    TMP_DUMP=""
    ls -1t "$STATE_DIR"/pre-deploy-*.dump 2>/dev/null | tail -n +6 | xargs -r rm -f || true
  else
    echo "[deploy] warning: pre-deploy pg_dump failed; continuing without empty dump"
    rm -f "$TMP_DUMP"
    TMP_DUMP=""
  fi
fi

PREV="$CURRENT"
echo "$TARGET" > "$STATE_DIR/deploying"

docker compose -f "$COMPOSE_FILE" build api worker scheduler backup
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate
docker compose -f "$COMPOSE_FILE" up -d postgres api worker scheduler files gotenberg backup

ok=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "[deploy] health gate failed; rolling back to ${PREV:-none}"
  echo "$TARGET" > "$STATE_DIR/failed"
  rm -f "$STATE_DIR/deploying"
  if [[ -n "$PREV" ]]; then
    git reset -q --hard "$PREV" || true
    UTILITY_TAG="$PREV" docker compose -f "$COMPOSE_FILE" up -d --no-build api worker scheduler files backup || true
  fi
  exit 1
fi

rm -f "$STATE_DIR/failed" "$STATE_DIR/blocked" "$STATE_DIR/deploying"
echo "$TARGET" > "$STATE_DIR/deployed"
echo "$TARGET $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$STATE_DIR/history"
echo "[deploy] success $TARGET"
