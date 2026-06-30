#!/usr/bin/env bash
set -euo pipefail

export URAI_PRIVACY_REQUIRE_LIVE=1
export URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF=1

if [ -z "${URAI_PRIVACY_BASE_URL:-}" ]; then
  echo "[final-production-lock] URAI_PRIVACY_BASE_URL is required" >&2
  exit 1
fi

if [ -z "${URAI_PRIVACY_AUTH_LIVE_PROOF_PATH:-}" ]; then
  export URAI_PRIVACY_AUTH_LIVE_PROOF_PATH="release-evidence/authenticated-live/AUTHENTICATED_LIVE_WORKFLOW_PROOF.json"
fi

echo "[final-production-lock] Running full release verification with strict live and authenticated proof gates"
bash scripts/verify-release.sh

echo "[final-production-lock] OK: strict final production lock passed"
