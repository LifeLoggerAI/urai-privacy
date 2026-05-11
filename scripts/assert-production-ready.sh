#!/usr/bin/env bash
set -euo pipefail

failures=0

fail() {
  echo "[production-ready] FAIL: $1" >&2
  failures=$((failures + 1))
}

require_file() {
  if [ ! -f "$1" ]; then
    fail "missing required file: $1"
  fi
}

require_absent() {
  if [ -e "$1" ]; then
    fail "generated or stale artifact must not be committed: $1"
  fi
}

require_file package.json
require_file next.config.mjs
require_file firebase.json
require_file firestore.rules
require_file storage.rules
require_file firestore.indexes.json
require_file app/layout.tsx
require_file scripts/verify-release.sh
require_file docs/FINAL_SYSTEM_REPORT.md
require_file docs/RELEASE_CHECKLIST.md

require_absent firebase/firebase.js
require_absent ._backup_deps

if git ls-files | grep -E '(^\._backup_deps/|tsconfig\.tsbuildinfo|firebase/firebase\.js)' >/dev/null; then
  fail "generated or stale artifacts must not be tracked by git"
fi

if grep -R "packageManager.*pnpm\|pnpm " -n package.json app components lib middleware.ts next.config.mjs .github 2>/dev/null; then
  fail "active app/runtime files still reference pnpm"
fi

if grep -n "ignoreBuildErrors: true\|ignoreDuringBuilds: true" next.config.mjs >/dev/null; then
  fail "next.config.mjs still bypasses TypeScript or ESLint during builds"
fi

if ! grep -n "metadataBase: new URL" app/layout.tsx >/dev/null; then
  fail "app/layout.tsx is missing metadataBase"
fi

if ! grep -n "firebaseApp" firebase/firebase.ts >/dev/null 2>&1; then
  fail "firebase/firebase.ts must export firebaseApp"
fi

if [ "$failures" -gt 0 ]; then
  echo "[production-ready] NOT READY: $failures blocker(s) found" >&2
  exit 1
fi

echo "[production-ready] static production-readiness assertions passed"
