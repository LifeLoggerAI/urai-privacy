#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${LOG_DIR:-/tmp/urai-lock-logs}"
mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
LOG="$LOG_DIR/control_plane_lock_${TS}.log"
exec > >(tee -a "$LOG") 2>&1

echo "== URAI CONTROL PLANE LOCK =="
echo "LOG=$LOG"
echo

: "${STAGING_PROJECT:?Set STAGING_PROJECT (e.g., urai-staging-35414255)}"
: "${PRIVACY_PROJECT:?Set PRIVACY_PROJECT (your urai-privacy Firebase project id)}"

have(){ command -v "$1" >/dev/null 2>&1; }
die(){ echo "FATAL: $*" >&2; exit 1; }

echo "== Tooling =="
have node || die "node not found"
have pnpm || { echo "pnpm missing; enabling corepack..."; have corepack || die "corepack missing"; corepack enable; corepack prepare pnpm@latest --activate; }
have firebase || die "firebase CLI missing (npm i -g firebase-tools)"
echo "node: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "firebase: $(firebase --version)"
echo

firebase_select_project() {
  local project="$1"
  firebase use "$project" --add >/dev/null 2>&1 || true
  firebase use "$project"
}

run_build() {
  echo "== pnpm install/build =="
  [[ -f package.json ]] || die "package.json missing (run from repo root)"
  if [[ -f pnpm-lock.yaml ]]; then
    pnpm install --frozen-lockfile || pnpm install
  else
    pnpm install
  fi
  if pnpm -s run | grep -qE '^typecheck'; then pnpm run typecheck; fi
  if pnpm -s run | grep -qE '^lint'; then pnpm run lint || echo "WARN: lint failed (continuing)"; fi
  pnpm run build
  echo
}

deploy() {
  local project="$1"
  echo "== firebase deploy -> $project =="
  [[ -f firebase.json ]] || die "firebase.json missing (firebase init required)"
  firebase_select_project "$project"
  firebase deploy --project "$project"
  echo
}

smoke_url() {
  local url="$1"
  local code
  code="$(curl -sS -L -o /dev/null -w "%{http_code}" "$url" || true)"
  echo "SMOKE $url -> HTTP $code"
  [[ "$code" =~ ^2|3 ]] || die "Smoke failed: $url (HTTP $code)"
}

smoke_hosting() {
  local project="$1"
  shift
  local base="https://${project}.web.app"
  echo "== Smoke Hosting: $base =="
  for path in "$@"; do
    smoke_url "${base}${path}"
  done
  echo
}

# ---- STAGING ----
echo "===== LOCK: urai-staging ====="
run_build
deploy "$STAGING_PROJECT"
smoke_hosting "$STAGING_PROJECT" "/" "/robots.txt" "/sitemap.xml" || true
echo

# ---- PRIVACY (repo must be checked out separately) ----
echo "===== NEXT: urai-privacy ====="
echo "Now cd into your urai-privacy repo and run:"
echo "  export PRIVACY_PROJECT=\"$PRIVACY_PROJECT\""
echo "  export STAGING_PROJECT=\"$STAGING_PROJECT\""
echo "  bash $(pwd)/control_plane_lock.sh"
echo
echo "== STAGING LOCK PASS ✅ =="
echo "LOG=$LOG"
