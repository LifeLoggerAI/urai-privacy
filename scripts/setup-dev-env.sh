#!/usr/bin/env bash
set -euo pipefail

echo "[setup-dev-env] URAI Privacy local verification setup"

if command -v java >/dev/null 2>&1; then
  echo "[setup-dev-env] Java already available:"
  java -version
else
  echo "[setup-dev-env] Java is not currently available on PATH."
  echo "[setup-dev-env] In Nix/Replit-style environments, rebuild or reload the workspace after dev.nix changes."
  echo "[setup-dev-env] dev.nix includes pkgs.jdk21 so the current Firebase emulators can run."
fi

if command -v node >/dev/null 2>&1; then
  echo "[setup-dev-env] Node: $(node --version)"
else
  echo "[setup-dev-env] Node is not available. dev.nix includes pkgs.nodejs_20."
fi

if command -v npm >/dev/null 2>&1; then
  echo "[setup-dev-env] npm: $(npm --version)"
else
  echo "[setup-dev-env] npm is not available. dev.nix includes Node/npm."
fi

echo "[setup-dev-env] Next steps:"
echo "  1. Rebuild/reload the workspace so dev.nix packages are applied."
echo "  2. Run: npm run check:java"
echo "  3. Run: bash scripts/verify-release.sh"
