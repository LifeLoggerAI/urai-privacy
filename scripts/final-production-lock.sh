#!/usr/bin/env bash
set -euo pipefail

export URAI_PRIVACY_REQUIRE_LIVE=1
export URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF=1

if [ -z "${URAI_PRIVACY_BASE_URL:-}" ]; then
  echo "[final-production-lock] URAI_PRIVACY_BASE_URL is required" >&2
  exit 1
fi

if [ -z "${URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT:-}" ]; then
  echo "[final-production-lock] URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT is required" >&2
  exit 1
fi

if ! actual_sha="$(git rev-parse HEAD 2>/dev/null)" || ! [[ "$actual_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "[final-production-lock] Unable to resolve the exact checked-out Git SHA" >&2
  exit 1
fi

if [ -n "${URAI_PRIVACY_EXPECTED_COMMIT_SHA:-}" ] && [ "${URAI_PRIVACY_EXPECTED_COMMIT_SHA,,}" != "$actual_sha" ]; then
  echo "[final-production-lock] Provided expected SHA does not match checked-out HEAD: ${URAI_PRIVACY_EXPECTED_COMMIT_SHA} != ${actual_sha}" >&2
  exit 1
fi
export URAI_PRIVACY_EXPECTED_COMMIT_SHA="$actual_sha"

if [ -z "${URAI_PRIVACY_AUTH_LIVE_PROOF_PATH:-}" ]; then
  export URAI_PRIVACY_AUTH_LIVE_PROOF_PATH="release-evidence/authenticated-live/AUTHENTICATED_LIVE_WORKFLOW_PROOF.json"
fi

echo "[final-production-lock] Running strict release verification for SHA ${URAI_PRIVACY_EXPECTED_COMMIT_SHA}, Firebase project ${URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT}, and ${URAI_PRIVACY_BASE_URL}"
bash scripts/verify-release.sh

echo "[final-production-lock] OK: strict final production lock passed"
