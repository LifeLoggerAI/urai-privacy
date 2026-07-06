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
# Exclude lockfiles and known detector sources so the gate does not flag its own
# secret-signature patterns as committed credentials.
if git grep -nE '(AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|firebase_private_key|GOOGLE_APPLICATION_CREDENTIALS=.*\.json|serviceAccountKey)' -- . ':!package-lock.json' ':!functions/package-lock.json' ':!scripts/security-gate.sh' ':!scripts/smoke-live.mjs'; then
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

echo "[security-gate] Checking trusted administrator authority"
require_pattern "firestore.rules" 'request\.auth\.token\.admin == true' "Firestore admin custom claim"
require_pattern "firestore.rules" "request\.auth\.token\.role == 'admin'" "Firestore role custom claim"
require_pattern "storage.rules" 'request\.auth\.token\.admin == true' "Storage admin custom claim"
require_pattern "storage.rules" "request\.auth\.token\.role == 'admin'" "Storage role custom claim"
reject_pattern "firestore.rules" 'function isRoleAdmin|documents/users/.+data\.role.+admin' "user-document-derived admin authority"
reject_pattern "functions/src/index.ts" 'snap\.data\(\)\?\.role === "admin"' "callable user-document-derived admin authority"

echo "[security-gate] Checking server-mediated privacy evidence rules"
require_pattern "firestore.rules" 'match /auditLogs/[{]id[}]' "Audit log match"
require_pattern "firestore.rules" 'allow (create, )?update, delete: if false|allow update: if false' "Audit log update deny"
require_pattern "firestore.rules" 'allow (create, update, )?delete: if false|allow delete: if false' "Audit log delete deny"
require_pattern "firestore.rules" 'ownerIsNotCreatingPrivilegedFields' "Privileged user create guard"
require_pattern "firestore.rules" 'ownerIsNotChangingPrivilegedFields' "Privileged user update guard"
require_pattern "firestore.rules" 'allow create, update, delete: if false' "Server-mediated mutation rule"

reject_pattern "storage.rules" 'allow[[:space:]]+delete:[[:space:]]+if[[:space:]]+(true|isAdmin\(\)|request\.auth)' "Storage delete allowance"

echo "[security-gate] Full npm audit visibility (non-blocking)"
npm audit --omit=dev || true
npm --prefix functions audit --omit=dev || true

echo "[security-gate] Enforcing critical vulnerability gate"
npm audit --audit-level=critical --omit=dev
npm --prefix functions audit --audit-level=critical --omit=dev

echo "[security-gate] ok"
