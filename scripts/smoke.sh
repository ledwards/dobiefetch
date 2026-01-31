#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required to run smoke test" >&2
  exit 1
fi

npm run build

node dist/collector/index.js --dry-run --limit=5

API_KEY=${API_KEY:-"local-dev"}
export API_KEY

node dist/server/index.js &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 1
curl -s -H "X-API-Key: $API_KEY" "http://localhost:${PORT:-3000}/records?limit=1" >/dev/null

echo "Smoke test completed"
