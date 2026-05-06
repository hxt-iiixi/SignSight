SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:

ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
APP_DIR := $(ROOT_DIR)app
BACKEND_DIR := $(ROOT_DIR)backend
ADMIN_DIR := $(ROOT_DIR)web-frontend
SERVER_ENV_FILE := $(BACKEND_DIR)/.env
MOBILE_ENV_FILE := $(APP_DIR)/.env.local
ADMIN_ENV_FILE := $(ADMIN_DIR)/.env.local
VENV_PYTHON := $(BACKEND_DIR)/.venv/bin/python
UVICORN_APP := server:app
UVICORN_HOST := 0.0.0.0
UVICORN_PORT := 8000

.DEFAULT_GOAL := help

.PHONY: \
	help \
	init \
	setup \
	run \
	backend \
	app \
	android \
	dev-client \
	admin \
	admin-build \
	admin-lint \
	benchmark-landmarks \
	evaluate-landmarks \
	promote-landmarks

help:
	@printf "SignSight development commands\n\n"
	printf "  make init                 Install dependencies and create local env files\n"
	printf "  make setup                Alias for init\n"
	printf "  make run                  Start backend + Expo, refresh local env files, and stop cleanly on exit\n"
	printf "  make backend              Run the FastAPI backend on port $(UVICORN_PORT)\n"
	printf "  make app                  Start the Expo app with a cleared cache\n"
	printf "  make android              Build and run the Expo Android app\n"
	printf "  make dev-client           Start Expo in dev-client mode\n"
	printf "  make admin                Run the Next.js admin UI\n"
	printf "  make admin-build          Build the Next.js admin UI\n"
	printf "  make admin-lint           Lint the Next.js admin UI\n"
	printf "  make benchmark-landmarks  Benchmark landmark model candidates\n"
	printf "  make evaluate-landmarks   Evaluate landmark confusion families\n"
	printf "  make promote-landmarks    Promote pending landmark records to approved\n"

init:
	@cd "$(ROOT_DIR)"
	./init.sh

setup: init

run:
	@APP_DIR="$(APP_DIR)"
	ADMIN_DIR="$(ADMIN_DIR)"
	SERVER_DIR="$(BACKEND_DIR)"
	SERVER_ENV_FILE="$(SERVER_ENV_FILE)"
	MOBILE_ENV_FILE="$(MOBILE_ENV_FILE)"
	ADMIN_ENV_FILE="$(ADMIN_ENV_FILE)"
	PIDS=()
	PGIDS=()

	log() {
	  printf '[run] %s\n' "$$1"
	}

	fail() {
	  printf '[run] Error: %s\n' "$$1" >&2
	  exit 1
	}

	need_path() {
	  local path="$$1"
	  local message="$$2"

	  [[ -e "$$path" ]] || fail "$$message"
	}

	need_cmd() {
	  local cmd="$$1"
	  local hint="$$2"

	  command -v "$$cmd" >/dev/null 2>&1 || fail "Missing '$$cmd'. $$hint"
	}

	detect_lan_ip() {
	  if [[ -n "$${MOBILE_API_BASE:-}" ]]; then
	    printf '%s\n' "$${MOBILE_API_BASE%/}"
	    return
	  fi

	  if command -v ip >/dev/null 2>&1; then
	    local ip_addr
	    ip_addr="$$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($$i == "src") {print $$(i + 1); exit}}')"
	    if [[ -n "$$ip_addr" ]]; then
	      printf 'http://%s:$(UVICORN_PORT)\n' "$$ip_addr"
	      return
	    fi
	  fi

	  if command -v hostname >/dev/null 2>&1; then
	    local ip_addr
	    ip_addr="$$(hostname -I 2>/dev/null | awk '{print $$1}')"
	    if [[ -n "$$ip_addr" ]]; then
	      printf 'http://%s:$(UVICORN_PORT)\n' "$$ip_addr"
	      return
	    fi
	  fi

	  printf 'http://127.0.0.1:$(UVICORN_PORT)\n'
	}

	write_local_envs() {
	  local mobile_api_base="$$1"
	  local admin_api_base="$${ADMIN_API_BASE:-http://127.0.0.1:$(UVICORN_PORT)}"

	  printf 'EXPO_PUBLIC_API_BASE=%s\n' "$$mobile_api_base" >"$$MOBILE_ENV_FILE"
	  printf 'NEXT_PUBLIC_API_BASE=%s\n' "$${admin_api_base%/}" >"$$ADMIN_ENV_FILE"
	}

	cleanup() {
	  local code="$$?"

	  if [[ $${#PIDS[@]} -gt 0 || $${#PGIDS[@]} -gt 0 ]]; then
	    log "Stopping services"

	    local pgid
	    for pgid in "$${PGIDS[@]}"; do
	      [[ -n "$$pgid" ]] || continue
	      kill -- "-$$pgid" >/dev/null 2>&1 || true
	    done

	    if [[ $${#PIDS[@]} -gt 0 ]]; then
	      kill "$${PIDS[@]}" >/dev/null 2>&1 || true
	      wait "$${PIDS[@]}" >/dev/null 2>&1 || true
	    fi
	  fi

	  exit "$$code"
	}

	start_service() {
	  local name="$$1"
	  local dir="$$2"
	  local cmd="$$3"
	  local pgid_file
	  local service_pid
	  local pgid=""
	  local deadline

	  pgid_file="$$(mktemp)"

	  (
	    cd "$$dir"
	    setsid bash -lc "echo \$$\$$ > \"$$pgid_file\"; $$cmd" 2>&1 | sed -u "s/^/[$$name] /"
	  ) &
	  service_pid="$$!"
	  PIDS+=("$$service_pid")

	  deadline=$$((SECONDS + 5))
	  while [[ ! -s "$$pgid_file" && $$SECONDS -lt $$deadline ]]; do
	    sleep 0.05
	  done

	  if [[ -s "$$pgid_file" ]]; then
	    pgid="$$(<"$$pgid_file")"
	    PGIDS+=("$$pgid")
	  fi

	  rm -f "$$pgid_file"
	}

	run_foreground_service() {
	  local dir="$$1"
	  local cmd="$$2"

	  cd "$$dir"
	  bash -lc "$$cmd"
	}

	need_cmd bash "Install bash."
	need_cmd node "Install Node.js 20 LTS or newer."
	need_cmd npm "Install npm with Node.js."
	need_cmd python3 "Install Python 3.10 or newer."

	need_path "$$APP_DIR/node_modules" "Expo dependencies are missing. Run make init first."
	need_path "$$ADMIN_DIR/node_modules" "Admin dependencies are missing. Run make init first."
	need_path "$$SERVER_DIR/.venv" "Backend virtual environment is missing. Run make init first."
	need_path "$$SERVER_DIR/.venv/bin/python" "Backend Python virtual environment is incomplete. Run make init again."
	need_path "$$SERVER_ENV_FILE" "Backend .env is missing. Run make init first."

	MOBILE_API_BASE_VALUE="$$(detect_lan_ip)"
	write_local_envs "$$MOBILE_API_BASE_VALUE"

	trap cleanup INT TERM EXIT

	log "Using mobile backend URL $$MOBILE_API_BASE_VALUE"
	printf '\n'
	printf 'Starting services:\n'
	printf '  Backend:    http://127.0.0.1:$(UVICORN_PORT)\n'
	printf '  Mobile API: %s\n' "$$MOBILE_API_BASE_VALUE"
	printf '\n'

	start_service "backend" "$$SERVER_DIR" "exec .venv/bin/python -m uvicorn $(UVICORN_APP) --host $(UVICORN_HOST) --port $(UVICORN_PORT) --reload"
	log "Launching Expo in the foreground so the QR code and interactive controls stay visible"
	run_foreground_service "$$APP_DIR" "exec npx expo start -c"

backend:
	@cd "$(BACKEND_DIR)"
	"$(VENV_PYTHON)" -m uvicorn "$(UVICORN_APP)" --host "$(UVICORN_HOST)" --port "$(UVICORN_PORT)" --reload

app:
	@cd "$(APP_DIR)"
	npx expo start -c

android:
	@cd "$(APP_DIR)"
	npm run android

dev-client:
	@cd "$(APP_DIR)"
	npx expo start --dev-client

admin:
	@cd "$(ADMIN_DIR)"
	npm run dev

admin-build:
	@cd "$(ADMIN_DIR)"
	npm run build

admin-lint:
	@cd "$(ADMIN_DIR)"
	npm run lint

benchmark-landmarks:
	@cd "$(BACKEND_DIR)"
	"$(VENV_PYTHON)" scripts/benchmark_landmark_models.py

evaluate-landmarks:
	@cd "$(BACKEND_DIR)"
	"$(VENV_PYTHON)" scripts/evaluate_landmark_confusions.py

promote-landmarks:
	@cd "$(BACKEND_DIR)"
	"$(VENV_PYTHON)" scripts/promote_pending_landmarks_to_approved.py
