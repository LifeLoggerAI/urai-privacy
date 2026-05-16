#!/usr/bin/env bash
set -euo pipefail

echo "[security-gate] Checking for committed secret material"
if git grep -nE '(AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|firebase_private_key|GOOGLE_APPLICATION_CREDENTIALS=.*\.json|serviceAccountKey)' -- . ':!package-lock.json' ':!functions/package-lock.json' ':!scripts/security-gate.sh'; then
  echo "[security-gate] Potential secret material found" >&2
  exit 1
fi

echo "[security-gate] Checking Firebase rules are deny-by-default"
grep -q 'match /{document=**}' firestore.rules
if ! grep -q 'allow read, write: if false' firestore.rules; then
  grep -q 'allow read: if false' firestore.rules
  grep -q 'allow write: if false' firestore.rules
fi

grep -q 'match /{allPaths=**}' storage.rules
if ! grep -q 'allow read, write: if false' storage.rules; then
  grep -q 'allow read: if false' storage.rules
  grep -q 'allow write: if false' storage.rules
fi

echo "[security-gate] Checking immutable privacy evidence rules"
grep -q 'match /auditLogs/{id}' firestore.rules
grep -q 'allow update, delete: if false' firestore.rules
grep -q 'allow delete: if false' storage.rules

echo "[security-gate] npm audit summary"
npm audit --audit-level=critical --omit=dev
npm --prefix functions audit --audit-level=critical --omit=dev

echo "[security-gate] ok"
