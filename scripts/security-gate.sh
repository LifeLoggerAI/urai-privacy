#!/usr/bin/env bash
set -euo pipefail

failures=0

fail() {
  echo "[security-gate] FAIL: $1" >&2
  failures=$((failures + 1))
}

check_absent_path() {
  if [ -e "$1" ]; then
    fail "forbidden local/generated artifact exists: $1"
  fi
}

check_absent_path ".env"
check_absent_path ".env.local"
check_absent_path ".env.production"
check_absent_path ".env.staging"
check_absent_path ".firebase"
check_absent_path ".next"
check_absent_path "._backup_deps"
check_absent_path "firebase/firebase.js"
check_absent_path "pnpm-lock.yaml"

if git ls-files | grep -E '(^\.env$|^\.env\.local$|^\.env\.production$|^\.env\.staging$|^\.firebase/|^\.next/|^\._backup_deps/|tsconfig\.tsbuildinfo|firebase/firebase\.js|pnpm-lock\.yaml)' >/dev/null; then
  fail "forbidden local/generated artifacts are tracked by git"
fi

if grep -R "BEGIN PRIVATE KEY\|PRIVATE KEY-----\|firebase-adminsdk\|serviceAccount" -n . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  --exclude-dir=coverage \
  --exclude='*.lock' \
  --exclude='.gitignore' \
  --exclude='scripts/security-gate.sh' \
  --exclude='tools/check_secrets.py' >/dev/null 2>&1; then
  fail "potential private key or service-account reference found"
fi

if grep -R "packageManager.*pnpm\|pnpm " -n package.json app components lib middleware.ts next.config.mjs .github 2>/dev/null; then
  fail "active runtime/app files still reference pnpm"
fi

if grep -n "ignoreBuildErrors: true\|ignoreDuringBuilds: true" next.config.mjs >/dev/null; then
  fail "Next build still bypasses TypeScript or ESLint"
fi

if ! grep -n "metadataBase: new URL" app/layout.tsx >/dev/null; then
  fail "metadataBase is missing from app/layout.tsx"
fi

if [ "$failures" -gt 0 ]; then
  echo "[security-gate] NOT READY: $failures issue(s) found" >&2
  exit 1
fi

echo "[security-gate] ok"
