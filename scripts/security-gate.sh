#!/usr/bin/env bash
set -euo pipefail

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"

  if ! grep -Eq "$pattern" "$file"; then
    echo "[security-gate] Missing: $label in $file" >&2
    exit 1
  fi
}

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"

  if grep -Eq "$pattern" "$file"; then
    echo "[security-gate] Forbidden: $label in $file" >&2
    exit 1
  fi
}

echo "[security-gate] Checking for committed secret material"
if git grep -nE '(AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|firebase_private_key|GOOGLE_APPLICATION_CREDENTIALS=.*\.json|serviceAccountKey)' -- . ':!package-lock.json' ':!functions/package-lock.json' ':!scripts/security-gate.sh'; then
  echo "[security-gate] Potential secret material found" >&2
  exit 1
fi

echo "[security-gate] Checking Firebase rules are deny-by-default"
require_pattern "firestore.rules" 'match /[{]document=[*][*][}]' "Firestore fallback match"
require_pattern "firestore.rules" 'allow read, write: if false|allow read: if false' "Firestore deny reads"
require_pattern "firestore.rules" 'allow read, write: if false|allow write: if false' "Firestore deny writes"

require_pattern "storage.rules" 'match /[{]allPaths=[*][*][}]' "Storage fallback match"
require_pattern "storage.rules" 'allow read, write: if false|allow read: if false' "Storage deny reads"
require_pattern "storage.rules" 'allow read, write: if false|allow write: if false' "Storage deny writes"

echo "[security-gate] Checking immutable privacy evidence rules"
require_pattern "firestore.rules" 'match /auditLogs/[{]id[}]' "Audit log match"
require_pattern "firestore.rules" 'allow update, delete: if false|allow update: if false' "Audit log update deny"
require_pattern "firestore.rules" 'allow update, delete: if false|allow delete: if false' "Audit log delete deny"

reject_pattern "storage.rules" 'allow[[:space:]]+delete:[[:space:]]+if[[:space:]]+(true|isAdmin\(\)|request\.auth)' "Storage delete allowance"

echo "[security-gate] npm audit summary"
npm audit --audit-level=critical --omit=dev
npm --prefix functions audit --audit-level=critical --omit=dev

echo "[security-gate] ok"
