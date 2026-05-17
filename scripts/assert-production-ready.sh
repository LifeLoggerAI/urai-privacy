#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "firebase.json"
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
    return path ~ /^(\.idx\/|\.next\/|functions\/lib\/|firestore-debug\.log$|firebase-debug\.log$|ui-debug\.log$|database-debug\.log$|storage-debug\.log$|pubsub-debug\.log$|.*\.debug\.log$|tsconfig\.tsbuildinfo$|functions\/tsconfig\.tsbuildinfo$)/
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

echo "[assert-production-ready] Checking Firebase deploy config"
grep -q '"firestore"' firebase.json
grep -q '"storage"' firebase.json
grep -q '"hosting"' firebase.json
grep -q '"functions"' firebase.json

echo "[assert-production-ready] Checking public env contract"
if [[ ! -f ".env.example" ]]; then
  echo "[assert-production-ready] .env.example is required so deploy operators can validate secrets without exposing values" >&2
  exit 1
fi

grep -q 'NEXT_PUBLIC_FIREBASE_API_KEY' .env.example
grep -q 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' .env.example
grep -q 'NEXT_PUBLIC_FIREBASE_APP_ID' .env.example

echo "[assert-production-ready] Checking deployment docs"
if [[ ! -f "docs/PRODUCTION_READINESS.md" ]]; then
  echo "[assert-production-ready] docs/PRODUCTION_READINESS.md is required" >&2
  exit 1
fi

grep -q 'Firebase project' docs/PRODUCTION_READINESS.md
grep -q 'Rollback' docs/PRODUCTION_READINESS.md
grep -q 'Smoke test' docs/PRODUCTION_READINESS.md

echo "[assert-production-ready] ok: code release checks passed; live deploy still requires operator env/project verification"
