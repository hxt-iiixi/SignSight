#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
ADMIN_DIR="$APP_DIR/signsight-admin"
SERVER_DIR="$APP_DIR/src/server"
SERVER_ENV_FILE="$SERVER_DIR/.env"
MOBILE_ENV_FILE="$APP_DIR/.env.local"
ADMIN_ENV_FILE="$ADMIN_DIR/.env.local"

log() {
  printf '[init] %s\n' "$1"
}

fail() {
  printf '[init] Error: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  local cmd="$1"
  local hint="$2"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing '$cmd'. $hint"
  fi
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

write_file() {
  local path="$1"
  local content="$2"

  if [[ -f "$path" ]]; then
    log "Preserving existing $(realpath --relative-to="$ROOT_DIR" "$path" 2>/dev/null || printf '%s' "$path")"
    return
  fi

  printf '%s' "$content" >"$path"
  log "Created $(realpath --relative-to="$ROOT_DIR" "$path" 2>/dev/null || printf '%s' "$path")"
}

need_cmd node "Install Node.js 20 LTS or newer."
need_cmd npm "Install npm with Node.js."
need_cmd python3 "Install Python 3.10 or newer."

MOBILE_API_BASE_VALUE="$(detect_lan_ip)"
ADMIN_API_BASE_VALUE="${ADMIN_API_BASE:-http://127.0.0.1:8000}"

log "Installing Expo app dependencies"
(cd "$APP_DIR" && npm ci)

log "Installing admin app dependencies"
(cd "$ADMIN_DIR" && npm ci)

if [[ ! -d "$SERVER_DIR/.venv" ]]; then
  log "Creating Python virtual environment"
  (cd "$SERVER_DIR" && python3 -m venv .venv)
else
  log "Python virtual environment already exists"
fi

log "Installing backend dependencies"
(cd "$SERVER_DIR" && .venv/bin/pip install -r requirements.txt)

write_file "$SERVER_ENV_FILE" $'MONGO_URI=mongodb://127.0.0.1:27017\nMONGO_DB=signsight\n\nJWT_SECRET=change_me_now\nADMIN_USER=admin\nADMIN_PASS=admin123\n'

printf 'EXPO_PUBLIC_API_BASE=%s\n' "$MOBILE_API_BASE_VALUE" >"$MOBILE_ENV_FILE"
log "Wrote app/.env.local with mobile API base $MOBILE_API_BASE_VALUE"

printf 'NEXT_PUBLIC_API_BASE=%s\n' "${ADMIN_API_BASE_VALUE%/}" >"$ADMIN_ENV_FILE"
log "Wrote app/signsight-admin/.env.local with admin API base ${ADMIN_API_BASE_VALUE%/}"

if ! command -v mongosh >/dev/null 2>&1 && ! command -v mongo >/dev/null 2>&1; then
  log "MongoDB shell not found. That is okay if the server is installed and running separately."
fi

log "Initialization complete"
printf '\n'
printf 'Next steps:\n'
printf '  1. Start MongoDB if it is not already running.\n'
printf '  2. Review %s if you want custom admin credentials.\n' "$SERVER_ENV_FILE"
printf '  3. Run ./run.sh\n'
printf '\n'
printf 'Detected mobile backend URL: %s\n' "$MOBILE_API_BASE_VALUE"
printf 'Admin backend URL: %s\n' "${ADMIN_API_BASE_VALUE%/}"
