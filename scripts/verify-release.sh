#!/usr/bin/env bash
set -euo pipefail

if [ ! -f package-lock.json ]; then
  echo "[verify-release] package-lock.json is required for deterministic release verification" >&2
  exit 1
fi

if [ ! -f functions/package-lock.json ]; then
  echo "[verify-release] functions/package-lock.json is required for deterministic release verification" >&2
  exit 1
fi

export URAI_RELEASE_VERIFY=1

printf '\n[verify-release] npm ci\n'
npm ci

printf '\n[verify-release] functions npm ci\n'
npm ci --prefix functions

printf '\n[verify-release] lint\n'
npm run lint

printf '\n[verify-release] typecheck\n'
npm run typecheck

printf '\n[verify-release] unit tests\n'
npm run test:unit

printf '\n[verify-release] firebase rules static validation\n'
npm run test:rules:static

printf '\n[verify-release] route smoke validation\n'
npm run test:e2e

printf '\n[verify-release] Tier-One privacy control-plane audit\n'
npm run audit:tier-one

printf '\n[verify-release] next build\n'
npm run build

printf '\n[verify-release] functions build\n'
npm --prefix functions run build

printf '\n[verify-release] functions typecheck\n'
npm --prefix functions run typecheck

printf '\n[verify-release] Java check for Firebase emulators\n'
npm run check:java

printf '\n[verify-release] emulator-backed Firestore/Storage rules + callable integration tests\n'
npm run test:emulators

printf '\n[verify-release] security gate\n'
npm run security:gate

printf '\n[verify-release] production readiness assertions\n'
bash scripts/assert-production-ready.sh

printf '\n[verify-release] OK\n'
