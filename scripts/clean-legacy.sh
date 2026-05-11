#!/usr/bin/env bash
set -euo pipefail

echo "[clean-legacy] removing generated and stale local artifacts"
rm -rf .next out dist build coverage playwright-report test-results .firebase ._backup_deps tsconfig.tsbuildinfo
rm -f firebase/firebase.js firebase/firebase.jsx firebase/firebase.tsx firebase/index.js firebase/index.jsx firebase/index.tsx
rm -f pnpm-lock.yaml

echo "[clean-legacy] done"
