#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
ADMIN_DIR="$ROOT_DIR/web-frontend"
SERVER_DIR="$ROOT_DIR/backend"
SERVER_ENV_FILE="$SERVER_DIR/.env"
MOBILE_ENV_FILE="$APP_DIR/.env.local"
ADMIN_ENV_FILE="$ADMIN_DIR/.env.local"

PIDS=()
PGIDS=()

log() {
  printf '[run] %s\n' "$1"
}

fail() {
  printf '[run] Error: %s\n' "$1" >&2
  exit 1
}

need_path() {
  local path="$1"
  local message="$2"

  [[ -e "$path" ]] || fail "$message"
}

need_cmd() {
  local cmd="$1"
  local hint="$2"

  command -v "$cmd" >/dev/null 2>&1 || fail "Missing '$cmd'. $hint"
}

detect_lan_ip() {
  if [[ -n "${MOBILE_API_BASE:-}" ]]; then
    printf '%s\n' "${MOBILE_API_BASE%/}"
    return
  fi

  if command -v ip >/dev/null 2>&1; then
    local ip_addr
    ip_addr="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
    if [[ -n "$ip_addr" ]]; then
      printf 'http://%s:8000\n' "$ip_addr"
      return
    fi
  fi

  if command -v hostname >/dev/null 2>&1; then
    local ip_addr
    ip_addr="$(hostname -I 2>/dev/null | awk '{print $1}')"
    if [[ -n "$ip_addr" ]]; then
      printf 'http://%s:8000\n' "$ip_addr"
      return
    fi
  fi

  printf 'http://127.0.0.1:8000\n'
}

write_local_envs() {
  local mobile_api_base="$1"
  local admin_api_base="${ADMIN_API_BASE:-http://127.0.0.1:8000}"

  printf 'EXPO_PUBLIC_API_BASE=%s\n' "$mobile_api_base" >"$MOBILE_ENV_FILE"
  printf 'NEXT_PUBLIC_API_BASE=%s\n' "${admin_api_base%/}" >"$ADMIN_ENV_FILE"
}

check_mongo() {
  local mongo_uri="mongodb://127.0.0.1:27017"

  if [[ -f "$SERVER_ENV_FILE" ]]; then
    mongo_uri="$(python3 - "$SERVER_ENV_FILE" <<'PY'
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
mongo_uri = "mongodb://127.0.0.1:27017"
for line in env_path.read_text().splitlines():
    if line.startswith("MONGO_URI="):
        mongo_uri = line.split("=", 1)[1].strip()
        break
print(mongo_uri)
PY
)"
  fi

  python3 - "$mongo_uri" <<'PY'
import socket
import sys
from urllib.parse import urlparse

uri = sys.argv[1]
parsed = urlparse(uri)
host = parsed.hostname or "127.0.0.1"
port = parsed.port or 27017

try:
    with socket.create_connection((host, port), timeout=2):
        print(f"{host}:{port}")
except OSError as exc:
    print(f"{host}:{port}|{exc}")
    sys.exit(1)
PY
}

cleanup() {
  local code=$?

  if [[ ${#PIDS[@]} -gt 0 || ${#PGIDS[@]} -gt 0 ]]; then
    log "Stopping services"

    local pgid
    for pgid in "${PGIDS[@]}"; do
      [[ -n "$pgid" ]] || continue
      kill -- "-$pgid" >/dev/null 2>&1 || true
    done

    if [[ ${#PIDS[@]} -gt 0 ]]; then
      kill "${PIDS[@]}" >/dev/null 2>&1 || true
    fi

    wait "${PIDS[@]}" >/dev/null 2>&1 || true
  fi

  exit "$code"
}

start_service() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  local pgid_file
  local service_pid=""

  pgid_file="$(mktemp)"

  (
    cd "$dir"
    setsid bash -lc "echo \$\$ > \"$pgid_file\"; $cmd" 2>&1 | sed -u "s/^/[$name] /"
  ) &
  service_pid="$!"
  PIDS+=("$service_pid")

  local pgid=""
  local deadline=$((SECONDS + 5))
  while [[ ! -s "$pgid_file" && $SECONDS -lt $deadline ]]; do
    sleep 0.05
  done

  if [[ -s "$pgid_file" ]]; then
    pgid="$(<"$pgid_file")"
    PGIDS+=("$pgid")
  fi

  rm -f "$pgid_file"
}

run_foreground_service() {
  local dir="$1"
  local cmd="$2"

  cd "$dir"
  bash -lc "$cmd"
}

need_cmd bash "Install bash."
need_cmd node "Install Node.js 20 LTS or newer."
need_cmd npm "Install npm with Node.js."
need_cmd python3 "Install Python 3.10 or newer."

need_path "$APP_DIR/node_modules" "Expo dependencies are missing. Run ./init.sh first."
need_path "$ADMIN_DIR/node_modules" "Admin dependencies are missing. Run ./init.sh first."
need_path "$SERVER_DIR/.venv" "Backend virtual environment is missing. Run ./init.sh first."
need_path "$SERVER_DIR/.venv/bin/python" "Backend Python virtual environment is incomplete. Run ./init.sh again."
need_path "$SERVER_ENV_FILE" "Backend .env is missing. Run ./init.sh first."

MOBILE_API_BASE_VALUE="$(detect_lan_ip)"
write_local_envs "$MOBILE_API_BASE_VALUE"

trap cleanup INT TERM EXIT

if ! mongo_status="$(check_mongo)"; then
  fail "MongoDB is not reachable at ${mongo_status%%|*}. Start MongoDB and try again."
fi

log "Using mobile backend URL $MOBILE_API_BASE_VALUE"
log "Admin dashboard will use http://127.0.0.1:8000"
printf '\n'
printf 'Starting services:\n'
printf '  Admin UI: http://localhost:3000\n'
printf '  Backend:  http://127.0.0.1:8000\n'
printf '  Mobile API: %s\n' "$MOBILE_API_BASE_VALUE"
printf '\n'

start_service "backend" "$SERVER_DIR" "exec .venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
start_service "admin" "$ADMIN_DIR" "exec npm run dev"
log "Launching Expo in the foreground so the QR code and interactive controls stay visible"
run_foreground_service "$APP_DIR" "exec npx expo start -c"
