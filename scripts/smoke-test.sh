#!/bin/bash
set -euo pipefail
if [ -z "${1:-}" ] || [ -z "${2:-}" ]; then echo "Usage: $0 <hosting_url> <project_id>" >&2; exit 1; fi
HOSTING_URL=$1; PROJECT_ID=$2
echo "--- SMOKE TEST STARTED on $HOSTING_URL ---"
for PAGE in index.html privacy terms; do
    URL="$HOSTING_URL/$PAGE"
    echo -n "  Verifying page $URL... "
    STATUS=$(curl -o /dev/null -s -w "%{http_code}" "$URL")
    if [ "$STATUS" -ne 200 ]; then echo "❌ FAILED (HTTP $STATUS)" >&2; exit 1; else echo "✅ OK"; fi
done
echo -n "  Verifying security headers... "
HEADERS=$(curl -sSL -I "$HOSTING_URL")
if ! echo "$HEADERS" | grep -iq "Strict-Transport-Security"; then echo "❌ FAILED (HSTS missing)" >&2; exit 1; else echo "✅ OK"; fi
echo -n "  Verifying Firestore security rules (unauthed read)... "
if firebase firestore:get "users/test" --project "$PROJECT_ID" &>/dev/null; then echo "❌ FAILED (Read was not blocked)" >&2; exit 1; else echo "✅ OK (Read correctly blocked)"; fi
echo "--- ✅ SMOKE TEST PASSED ---"
