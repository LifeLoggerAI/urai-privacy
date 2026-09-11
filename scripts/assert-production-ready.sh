#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "firebase.json"
  "firebase.emulator.json"
  "firestore.rules"
  "firestore.indexes.json"
  "storage.rules"
  "package-lock.json"
  "functions/package.json"
  "functions/package-lock.json"
  "functions/src/index.ts"
  "scripts/security-gate.sh"
  "scripts/validate-rules.mjs"
  "scripts/smoke-routes.mjs"
  "scripts/smoke-live.mjs"
  "scripts/verify-authenticated-live-proof.mjs"
  "scripts/final-production-lock.sh"
  "scripts/staging-evidence.mjs"
  "scripts/urai-qa-checks.js"
  "docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md"
  "app/page.tsx"
  "app/privacy-center/export/page.tsx"
  "app/privacy-center/delete/page.tsx"
  "app/admin/privacy-requests/page.tsx"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[assert-production-ready] Missing required file: $file" >&2
    exit 1
  fi
done

echo "[assert-production-ready] Checking for uncommitted source changes"
status_file="$(mktemp)"
git status --porcelain > "$status_file"

non_generated_changes="$(awk '
  function is_generated(path) {
    return path ~ /^(\.firebase\/|\.idx\/|\.next\/|functions\/lib\/|release-evidence\/|firestore-debug\.log$|firebase-debug\.log$|ui-debug\.log$|database-debug\.log$|storage-debug\.log$|pubsub-debug\.log$|.*\.debug\.log$|tsconfig\.tsbuildinfo$|functions\/tsconfig\.tsbuildinfo$)/
  }
  {
    path = substr($0, 4)
    if (!is_generated(path)) print $0
  }
' "$status_file")"
rm -f "$status_file"

if [[ -n "$non_generated_changes" ]]; then
  echo "[assert-production-ready] Working tree has non-generated changes" >&2
  printf '%s\n' "$non_generated_changes" >&2
  exit 1
fi

echo "[assert-production-ready] Checking Firebase deploy and emulator config"
grep -q '"firestore"' firebase.json
grep -q '"storage"' firebase.json
grep -q '"hosting"' firebase.json
grep -q '"functions"' firebase.json
grep -q '"firestore"' firebase.emulator.json
grep -q '"storage"' firebase.emulator.json
grep -q '"functions"' firebase.emulator.json
if grep -q '"hosting"' firebase.emulator.json; then
  echo "[assert-production-ready] Emulator config must not depend on Firebase Frameworks Hosting" >&2
  exit 1
fi

echo "[assert-production-ready] Checking public env contract"
if [[ ! -f ".env.example" ]]; then
  echo "[assert-production-ready] .env.example is required so deploy operators can validate config without exposing values" >&2
  exit 1
fi

grep -q 'NEXT_PUBLIC_FIREBASE_API_KEY' .env.example
grep -q 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' .env.example
grep -q 'NEXT_PUBLIC_FIREBASE_APP_ID' .env.example
grep -q 'Admin access is authorized by Firebase Auth custom claims only' .env.example
if grep -q 'NEXT_PUBLIC_URAI_ADMIN_EMAIL' .env.example; then
  echo "[assert-production-ready] Public admin email env gate must not be documented" >&2
  exit 1
fi

echo "[assert-production-ready] Checking package release scripts"
grep -q '"test:smoke:live"' package.json
grep -q '"test:live-auth-proof"' package.json
grep -q '"final:production-lock"' package.json
grep -q '"release:evidence:staging"' package.json
grep -q '"test:export:contract"' package.json
grep -q '"test:deletion:contract"' package.json
grep -q '"firebase-tools": "15.24.0"' package.json
grep -q -- '--config firebase.emulators.json' package.json

echo "[assert-production-ready] Checking final production lock strictness"
grep -q 'URAI_PRIVACY_REQUIRE_LIVE=1' scripts/final-production-lock.sh
grep -q 'URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF=1' scripts/final-production-lock.sh
grep -q 'URAI_PRIVACY_BASE_URL is required' scripts/final-production-lock.sh
grep -q 'URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT is required' scripts/final-production-lock.sh
grep -q 'git rev-parse HEAD' scripts/final-production-lock.sh
grep -q 'URAI_PRIVACY_EXPECTED_COMMIT_SHA' scripts/final-production-lock.sh

echo "[assert-production-ready] Checking authenticated proof identity binding"
grep -q 'URAI_PRIVACY_EXPECTED_COMMIT_SHA' scripts/verify-authenticated-live-proof.mjs
grep -q 'URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT' scripts/verify-authenticated-live-proof.mjs
grep -q 'Strict authenticated live proof is blocked' scripts/verify-authenticated-live-proof.mjs
grep -q 'provider/runtime identity and workflow results must be obtained through an authenticated protected workflow or provider-issued attestation' scripts/verify-authenticated-live-proof.mjs
grep -q 'caller-supplied proof files, digests, revisions, and status fields are not release authority' scripts/verify-authenticated-live-proof.mjs

echo "[assert-production-ready] Checking rendered QA cannot pass vacuously"
grep -q 'checked === 0' scripts/urai-qa-checks.js
grep -q 'publicChecked === 0' scripts/urai-qa-checks.js
grep -q 'protectedChecked === 0' scripts/urai-qa-checks.js

echo "[assert-production-ready] Checking Java 21 release fallback"
grep -q 'nixpkgs#jdk21' scripts/verify-release.sh
grep -q 'nix-shell -p jdk21' scripts/verify-release.sh
if grep -Eq 'jdk17|JDK 17' scripts/verify-release.sh; then
  echo "[assert-production-ready] Release verifier must not fall back to Java 17" >&2
  exit 1
fi

echo "[assert-production-ready] Checking deployment docs"
if [[ ! -f "docs/PRODUCTION_READINESS.md" ]]; then
  echo "[assert-production-ready] docs/PRODUCTION_READINESS.md is required" >&2
  exit 1
fi

grep -q 'Firebase project' docs/PRODUCTION_READINESS.md
grep -q 'Rollback' docs/PRODUCTION_READINESS.md
grep -q 'Smoke test' docs/PRODUCTION_READINESS.md
grep -q 'AUTHENTICATED_LIVE_WORKFLOW_PROOF' docs/RELEASE_SIGNOFF.md
grep -q 'URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF' docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md
grep -q 'URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT' docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md
grep -q 'URAI_PRIVACY_EXPECTED_COMMIT_SHA' docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md

echo "[assert-production-ready] ok: code release checks passed; final READY requires npm run final:production-lock with exact live URL, Firebase project, checked-out SHA, and authenticated proof"
