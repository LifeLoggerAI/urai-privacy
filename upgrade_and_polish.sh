set -euo pipefail
set +H

# ===============================
# URAI-PRIVACY: deps upgrade + polish gate (NON-DESTRUCTIVE, AUTO-ROLLBACK ON FAIL)
# Run from anywhere inside the urai-privacy repo (or from monorepo root).
# ===============================

echo "== locate project root (package.json) =="
ROOT=""
if [ -f package.json ]; then
  ROOT="$(pwd)"
else
  # try to find a urai-privacy folder first, else any package.json nearest
  CAND="$(find "$(pwd)" -maxdepth 4 -type f -name package.json 2>/dev/null | rg -n "urai-privacy|privacy" -i | head -n1 | awk -F: '{print $2}' || true)"
  if [ -n "${CAND:-}" ] && [ -f "$CAND" ]; then
    ROOT="$(dirname "$CAND")"
  else
    CAND2="$(find "$(pwd)" -maxdepth 4 -type f -name package.json 2>/dev/null | head -n1 || true)"
    if [ -n "${CAND2:-}" ] && [ -f "$CAND2" ]; then
      ROOT="$(dirname "$CAND2")"
    fi
  fi
fi

if [ -z "${ROOT:-}" ]; then
  echo "FATAL: could not find package.json within 4 levels."
  exit 1
fi

cd "$ROOT"
echo "== ROOT: $ROOT =="

echo "== ensure pnpm via corepack =="
command -v corepack >/dev/null 2>&1 || true
corepack enable >/dev/null 2>&1 || true

echo "== snapshot (backup lock + package) =="
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p ._backup_deps/"$TS"
cp -f package.json ._backup_deps/"$TS"/package.json 2>/dev/null || true
cp -f pnpm-lock.yaml ._backup_deps/"$TS"/pnpm-lock.yaml 2>/dev/null || true
cp -f package-lock.json ._backup_deps/"$TS"/package-lock.json 2>/dev/null || true

echo "== install (clean) =="
if [ -d node_modules ]; then rm -rf node_modules; fi
pnpm install

echo "== report outdated (save to file) =="
pnpm outdated || true
pnpm outdated > ._backup_deps/"$TS"/pnpm_outdated.txt 2>/dev/null || true

echo "== SAFE UPDATES (same major) =="
pnpm update

echo "== enforce Next + eslint-config-next version alignment (if present) =="
# If both exist, force eslint-config-next to match next's version exactly.
if node -e "const p=require('./package.json'); process.exit(!(p.dependencies?.next||p.devDependencies?.next) || !(p.dependencies?.['eslint-config-next']||p.devDependencies?.['eslint-config-next']));"; then
  NEXT_VER="$(node -e "const p=require('./package.json'); console.log((p.dependencies?.next||p.devDependencies?.next||'').replace(/^[^0-9]*/,''));")"
  if [ -n "${NEXT_VER:-}" ]; then
    echo "== set eslint-config-next@$NEXT_VER =="
    pnpm add -D "eslint-config-next@${NEXT_VER}" >/dev/null 2>&1 || pnpm add -D "eslint-config-next@${NEXT_VER}"
  fi
fi

echo "== quality gates (lint/build) =="
set +e
pnpm run -s lint
LINT_RC=$?
pnpm run -s build
BUILD_RC=$?
set -e

if [ "$LINT_RC" -ne 0 ] || [ "$BUILD_RC" -ne 0 ]; then
  echo "!! FAIL: lint/build failed after SAFE updates. Rolling back lock/package to snapshot."
  if [ -f ._backup_deps/"$TS"/package.json ]; then cp -f ._backup_deps/"$TS"/package.json package.json; fi
  if [ -f ._backup_deps/"$TS"/pnpm-lock.yaml ]; then cp -f ._backup_deps/"$TS"/pnpm-lock.yaml pnpm-lock.yaml; fi
  rm -rf node_modules
  pnpm install
  echo "== rollback complete. Re-run after fixing errors. Snapshot: ._backup_deps/$TS =="
  exit 1
fi

echo "== OPTIONAL MAJOR UPGRADES (AUTO-TRY; AUTO-ROLLBACK ON FAIL) =="
echo "== attempting 'pnpm up --latest' (can introduce breaking changes) =="
cp -f package.json ._backup_deps/"$TS"/package.json.before_latest 2>/dev/null || true
cp -f pnpm-lock.yaml ._backup_deps/"$TS"/pnpm-lock.yaml.before_latest 2>/dev/null || true

set +e
pnpm up --latest
UP_RC=$?
set -e

if [ "$UP_RC" -ne 0 ]; then
  echo "!! pnpm up --latest failed; reverting to pre-latest state."
  cp -f ._backup_deps/"$TS"/package.json.before_latest package.json 2>/dev/null || true
  cp -f ._backup_deps/"$TS"/pnpm-lock.yaml.before_latest pnpm-lock.yaml 2>/dev/null || true
  rm -rf node_modules
  pnpm install
else
  echo "== re-align Next + eslint-config-next again (post-latest) =="
  if node -e "const p=require('./package.json'); process.exit(!(p.dependencies?.next||p.devDependencies?.next) || !(p.dependencies?.['eslint-config-next']||p.devDependencies?.['eslint-config-next']));"; then
    NEXT_VER="$(node -e "const p=require('./package.json'); console.log((p.dependencies?.next||p.devDependencies?.next||'').replace(/^[^0-9]*/,''));")"
    if [ -n "${NEXT_VER:-}" ]; then
      pnpm add -D "eslint-config-next@${NEXT_VER}" >/dev/null 2>&1 || pnpm add -D "eslint-config-next@${NEXT_VER}"
    fi
  fi

  echo "== gates after majors (lint/build). rollback if fail =="
  set +e
  pnpm run -s lint
  L2=$?
  pnpm run -s build
  B2=$?
  set -e

  if [ "$L2" -ne 0 ] || [ "$B2" -ne 0 ]; then
    echo "!! FAIL after majors. Rolling back to pre-latest state."
    cp -f ._backup_deps/"$TS"/package.json.before_latest package.json 2>/dev/null || true
    cp -f ._backup_deps/"$TS"/pnpm-lock.yaml.before_latest pnpm-lock.yaml 2>/dev/null || true
    rm -rf node_modules
    pnpm install
    pnpm run -s lint || true
    pnpm run -s build || true
    echo "== majors rolled back. Snapshot: ._backup_deps/$TS =="
  else
    echo "== majors kept (lint/build OK) =="
  fi
fi

echo "== VISUAL POLISH CHECKLIST (AUTOFIX FORMAT/LINT IF CONFIGURED) =="
# If you have prettier/eslint autofix scripts, run them; ignore if missing.
set +e
pnpm run -s format
pnpm run -s lint -- --fix
set -e

echo "== final gates =="
pnpm run -s lint
pnpm run -s build

echo "== DONE. Outdated report saved: ._backup_deps/$TS/pnpm_outdated.txt =="
echo "== NEXT: deploy (classic) =="
if command -v firebase >/dev/null 2>&1; then
  firebase --version || true
  firebase deploy
else
  echo "firebase CLI not found in PATH."
fi
