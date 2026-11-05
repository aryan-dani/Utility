#!/usr/bin/env bash
# Verify required env vars are present without printing values.
set -euo pipefail

ENV_FILE="${1:-/srv/utility/.env}"
REQUIRED=(
  POSTGRES_PASSWORD
  UTILITY_API_SECRET
  FIREBASE_PROJECT_ID
  FIREBASE_CLIENT_EMAIL
  FIREBASE_PRIVATE_KEY
)

missing=0
if [[ ! -f "$ENV_FILE" ]]; then
  echo "MISSING file: $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

for key in "${REQUIRED[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "MISSING $key"
    missing=1
  else
    echo "OK $key (set, value hidden)"
  fi
done

exit "$missing"
