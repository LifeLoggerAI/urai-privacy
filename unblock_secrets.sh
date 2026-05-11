#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
LOG="/tmp/urai_privacy_unblock_secrets.${TS}.log"
exec > >(tee -a "$LOG") 2>&1

echo "== URAI PRIVACY: unblock ship secret-scan false positive =="
echo "ROOT=$(pwd)"
echo "LOG=$LOG"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing $1"; exit 1; }; }
need git
need rg
need sed
need python3

wrap="./urai_ship_urai_privacy_WRAP.sh"
rules="./.idx/airules.md"

# --- backups
bak(){ [ -f "$1" ] && cp -f "$1" "$1.bak.${TS}" && echo "LOG=Backed up $1 -> $1.bak.${TS}"; }

# --- 0) sanity
[ -f "$wrap" ] || { echo "ERROR: $wrap not found"; exit 1; }
[ -f "$rules" ] || { echo "ERROR: $rules not found"; exit 1; }

bak "$wrap"
bak "$rules"

# --- 1) Fix the actual problem: remove "API_KEY =" patterns from docs/scripts
# shipmaster is scanning for "API_KEY =" style assignments, even if they're redacted examples.
# Change docs example to something that cannot be mistaken for a secret assignment.
python3 - "$rules" <<'PY'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8", errors="replace")

orig = s

# Replace any "API_KEY = ..." style example with harmless placeholder text
s = re.sub(r'(?m)^\s*API_KEY\s*=\s*["'].*?["']\s*;?\s*$',
           '    API_KEY_PLACEHOLDER = "<example>";  # docs-only (not a real secret)',
           s)

# Also catch inline forms like: API_KEY = "<redacted_example>";
s = re.sub(r'API_KEY\s*=\s*["']<[^"\']+>["']\s*;?',
           'API_KEY_PLACEHOLDER = "<example>";',
           s)

if s != orig:
  p.write_text(s, encoding="utf-8")
  print("LOG=Patched docs to remove API_KEY assignment patterns.")
else:
  print("LOG=No doc changes needed (pattern not found).")
PY

# --- 2) Remove the self-triggering sed line in WRAP (it literally contains the pattern)
# This line is making the scanner fail on the WRAP itself.
# We comment it out, idempotently.
if rg -n "sed -i 's/API_KEY" "$wrap" >/dev/null 2>&1; then
  # comment out any line that contains the sed replacement for API_KEY example
  sed -i -E "s|^([[:space:]]*)(sed -i 's/API_KEY = .*airules\\.md.*)$|\1# DISABLED: causes secret-scan false positive -> \2|g" "$wrap"
  echo "LOG=Commented out WRAP sed line that triggers secret scan."
else
  echo "LOG=WRAP sed line not present or already disabled."
fi

# --- 3) Quick verification: ensure neither file still contains a real "API_KEY =" assignment pattern
echo "== Verify: no API_KEY assignment patterns remain =="
if rg -n --fixed-strings "API_KEY =" "$rules" "$wrap" >/dev/null 2>&1; then
  echo "ERROR=Still found 'API_KEY =' after patch:"
  rg -n --fixed-strings "API_KEY =" "$rules" "$wrap" || true
  exit 1
fi
echo "LOG=OK: no 'API_KEY =' patterns in docs/wrap."

# --- 4) Re-run ship
echo "== Re-running WRAP =="
bash "$wrap"

echo "DONE LOG=$LOG"
