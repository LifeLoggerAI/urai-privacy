#!/usr/bin/env bash
set -euo pipefail

printf '\n[verify-release] npm install\n'
npm install

printf '\n[verify-release] lint\n'
npm run lint

printf '\n[verify-release] typecheck\n'
npm run typecheck

printf '\n[verify-release] tests\n'
npm run test

printf '\n[verify-release] firebase rules static validation\n'
npm run test:rules

printf '\n[verify-release] route smoke validation\n'
npm run test:e2e

printf '\n[verify-release] security gate\n'
npm run security:gate

printf '\n[verify-release] next build\n'
npm run build

printf '\n[verify-release] OK: Bash/Node local release verification commands passed\n'
