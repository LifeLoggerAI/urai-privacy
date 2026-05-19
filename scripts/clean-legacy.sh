#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Remove generated artifacts that should not affect a clean verification run.
# Keep source, lockfiles, Firebase config, and developer environment files intact.
rm -rf \
  .next \
  out \
  dist \
  coverage \
  .turbo \
  .firebase \
  firestore-debug.log \
  ui-debug.log \
  firebase-debug.log \
  storage-debug.log

find . -name "*.tsbuildinfo" -type f -not -path "./node_modules/*" -delete

echo "[clean:legacy] OK: generated legacy/build artifacts removed"
