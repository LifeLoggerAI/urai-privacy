set -euo pipefail
set +H

cd /home/user/urai-privacy

echo "== QUICK SANITY: do the files exist where Next expects? =="
ls -la . || true
ls -la src 2>/dev/null || true
ls -la lib 2>/dev/null || true
ls -la src/lib 2>/dev/null || true

echo
echo "== SHOW ALIAS CONFIG (paths/baseUrl) =="
if [ -f tsconfig.json ]; then
  echo "--- tsconfig.json ---"
  cat tsconfig.json
elif [ -f jsconfig.json ]; then
  echo "--- jsconfig.json ---"
  cat jsconfig.json
else
  echo "NO tsconfig.json/jsconfig.json"
fi

echo
echo "== CONFIRM IMPORTS THAT FAIL =="
rg -n "from ['\"]@/lib/\(firebase\|auth\)['\"]" app src || true

echo
echo "== RUN BUILD AND SHOW FULL ERROR =="
corepack enable >/dev/null 2>&1 || true
pnpm -s install || true
pnpm -s build
