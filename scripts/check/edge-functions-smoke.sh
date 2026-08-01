#!/usr/bin/env bash
set -euo pipefail

child_pid=""
log_file=""
body_file=""

cleanup() {
  if [[ -n "$child_pid" ]] && kill -0 "$child_pid" 2>/dev/null; then
    kill "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
  if [[ -n "$log_file" ]]; then rm -f "$log_file"; fi
  if [[ -n "$body_file" ]]; then rm -f "$body_file"; fi
  child_pid=""
  log_file=""
  body_file=""
}

trap cleanup EXIT INT TERM

smoke_function() {
  local function_name="$1"
  local http_code=""
  local attempt

  log_file="$(mktemp)"
  body_file="$(mktemp)"
  npx supabase functions serve "$function_name" \
    --no-verify-jwt \
    --env-file scripts/check/edge-smoke.env \
    >"$log_file" 2>&1 &
  child_pid=$!

  for attempt in $(seq 1 30); do
    if ! kill -0 "$child_pid" 2>/dev/null; then
      wait "$child_pid" 2>/dev/null || true
      printf 'Edge function %s exited before becoming ready.\n' "$function_name" >&2
      sed -n '1,240p' "$log_file" >&2
      return 1
    fi

    http_code="$(
      curl -sS \
        -o "$body_file" \
        -w '%{http_code}' \
        -X POST \
        -H 'Content-Type: application/json' \
        --data '{}' \
        "http://127.0.0.1:54321/functions/v1/$function_name" \
        2>/dev/null || true
    )"
    if [[ "$http_code" == "401" ]] && rg -q 'Unauthorized' "$body_file"; then
      printf '%s edge smoke passed\n' "$function_name"
      cleanup
      return 0
    fi
    sleep 1
  done

  printf 'Edge function %s did not return 401 Unauthorized.\n' "$function_name" >&2
  printf 'Last HTTP status: %s\n' "$http_code" >&2
  sed -n '1,240p' "$log_file" >&2
  return 1
}

smoke_function generate-mix
smoke_function regenerate-cover
