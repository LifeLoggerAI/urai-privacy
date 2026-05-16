#!/usr/bin/env bash
set -euo pipefail

printf '\n[verify-release] npm install\n'
npm install

printf '\n[verify-release] functions install\n'
npm install --prefix functions

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

printf '\n[verify-release] next build\n'
npm run build

printf '\n[verify-release] functions build\n'
npm --prefix functions run build

printf '\n[verify-release] functions typecheck\n'
npm --prefix functions run typecheck

printf '\n[verify-release] Java check for Firebase emulators\n'
java -version

printf '\n[verify-release] emulator-backed Firestore/Storage rules + callable integration tests\n'
npm run test:emulators

printf '\n[verify-release] security gate\n'
npm run security:gate

printf '\n[verify-release] production readiness assertions\n'
bash scripts/assert-production-ready.sh

printf '\n[verify-release] OK\n'
