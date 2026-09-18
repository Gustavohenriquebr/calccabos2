#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${CALCCABOS_FRONTEND_URL:-https://calccabos2.onrender.com}"
PYTHON_URL="${CALCCABOS_PYTHON_URL:-https://calccabos2-python.onrender.com}"
MAX_TIME="${SMOKE_MAX_TIME_SECONDS:-30}"

check() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local body_file
  body_file="$(mktemp)"
  trap 'rm -f "$body_file"' RETURN

  local status
  status="$(curl --fail-with-body --max-time "$MAX_TIME" -sS -o "$body_file" -w '%{http_code}' "$url")"
  if [[ "$status" != "$expected" ]]; then
    echo "[FAIL] $label: HTTP $status ($url)" >&2
    sed -n '1,5p' "$body_file" >&2 || true
    return 1
  fi
  echo "[OK] $label: HTTP $status"
}

echo "CalcCabos public smoke test"
check "landing" "$FRONTEND_URL/" "200"
check "Node liveness" "$FRONTEND_URL/health/live" "200"
check "Node health" "$FRONTEND_URL/health" "200"
check "Python health" "$PYTHON_URL/api/health" "200"
check "Python readiness" "$PYTHON_URL/api/ready" "200"
