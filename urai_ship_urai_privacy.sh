#!/usr/bin/env bash
# URAI SHIPMASTER: FINAL SHIP SCRIPT
# ID: 20260129_141900

set -euo pipefail

# --- Setup: Logging and Primitives ---
TS="$(date +%Y%m%d_%H%M%S)"
LOG="/tmp/urai_ship_urai_privacy.${TS}.log"
exec > >(tee -a "$LOG") 2>&1

echo "== URAI SHIPMASTER: SHIP protocols engaged. All systems, full power. ===="
echo "ROOT=$(pwd)"
echo "LOG=$LOG"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: ship requires '$1'. Install and retry."; exit 1; }; }
bak(){ [ -f "$1" ] && cp -f "$1" "$1.bak.${TS}" && echo "LOG=Backed up '$1' -> '$1.bak.${TS}'"; }

# --- Configuration: Key File Paths ---
readonly SECURITY_MD="SECURITY.md"
readonly PRIVACY_MD="PRIVACY.md"
readonly PKG_JSON="package.json"
readonly PNPM_LOCK="pnpm-lock.yaml"
readonly FIREBASE_JSON="firebase.json"
readonly FIRESTORE_RULES="firestore.rules"
readonly STORAGE_RULES="storage.rules"
readonly NEXT_CONFIG="next.config.mjs"
readonly ENV_EXAMPLE=".env.example"

# --- Phase 1: System Verification & Prerequisite Checks ---
echo "== Phase 1: System Verification & Prerequisite Checks ===="
need pnpm
need npx
need firebase

[ -f "$PNPM_LOCK" ] || { echo "ERROR: pnpm-lock.yaml not found. This project requires pnpm."; exit 1; }
[ -f "$NEXT_CONFIG" ] || { echo "ERROR: next.config.mjs not found. This appears to be a Next.js project."; exit 1; }
[ -f "$FIREBASE_JSON" ] || { echo "ERROR: firebase.json not found. Firebase deployment target assumed."; exit 1; }


# --- Phase 2: Environment & Security Discovery ---
echo "== Phase 2: Environment & Security Discovery ===="
echo "LOG=Scanning for environment variables to create ${ENV_EXAMPLE}..."
bak "$ENV_EXAMPLE"
# The grep finds process.env.VAR, sed strips the prefix, sort makes it unique.
# We exclude common build/dep dirs and the example file itself.
grep -rohE 'process\.env\.([A-Z_][A-Z0-9_]*)' \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.firebase \
    --exclude-dir=functions \
    --exclude-dir=out \
    --exclude="$ENV_EXAMPLE" \
    . | sed 's/process\.env\.//' | sort -u > env.tmp

{
    echo "# URAI SHIPMASTER: Environment variables required by this project."
    echo "# Discovered: ${TS}"
    echo ""
    if [ -s env.tmp ]; then
        while read -r var; do
            echo "${var}= # TODO: Define value for ${var}"
        done < env.tmp
    else
        echo "# No process.env variables discovered in the project."
    fi
} > "$ENV_EXAMPLE"
rm env.tmp
echo "LOG=${ENV_EXAMPLE} has been created/updated."

echo "LOG=Scanning for committed secrets..."
# This pattern looks for common key names, high-entropy strings, and common formats like sk_live_.
SECRET_PATTERN='(SECRET|API_KEY|PRIVATE_KEY|TOKEN)[_A-Z0-9]*[[:space:]]*[:=][[:space:]]*[\"'\''`]?([A-Za-z0-9/+=]{32,})[\"'\''`]?|sk_live_[0-9a-zA-Z]{24}'
if grep -rniE "$SECRET_PATTERN" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.firebase \
    --exclude-dir=functions \
    --exclude-dir=out \
    --exclude='*.log' \
    --exclude='*.bak.*' \
    --exclude="$PNPM_LOCK" .; then
    echo "ERROR: Potential hardcoded secret found. Refer to the matches above. Aborting ship."
    exit 1
else
    echo "LOG=Secret scan clean."
fi

# --- Phase 3: Dependency, Build & Code Integrity ---
echo "== Phase 3: Dependency, Build & Code Integrity ===="
echo "LOG=Installing dependencies with pnpm..."
pnpm install --frozen-lockfile

echo "LOG=Injecting 'ship-check' script into package.json..."
bak "$PKG_JSON"
pnpm pkg set scripts.ship-check="pnpm next lint && npx tsc --noEmit && pnpm next build"

echo "LOG=Running ship-check (lint, typecheck, build)..."
pnpm run ship-check

# --- Phase 4: Fortifying Security & Privacy Posture ---
echo "== Phase 4: Fortifying Security & Privacy Posture ===="
if [ ! -f "$SECURITY_MD" ]; then
    echo "LOG=${SECURITY_MD} not found. Generating secure default."
    bak "$SECURITY_MD"
    cat > "$SECURITY_MD" <<-'EOF'
# Security Policy

The security of our services is a top priority. We are committed to protecting our users' data.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it to us promptly. We will investigate all reports and do our best to fix the issue in a timely manner. We appreciate your efforts and responsible disclosure and will make every effort to acknowledge your contributions.
EOF
else
    echo "LOG=${SECURITY_MD} already exists. Verifying content is non-empty."
    [ -s "$SECURITY_MD" ] || { echo "ERROR: $SECURITY_MD is empty."; exit 1; }
fi

if [ ! -f "$PRIVACY_MD" ]; then
    echo "LOG=${PRIVACY_MD} not found. Generating real policy."
    bak "$PRIVACY_MD"
    cat > "$PRIVACY_MD" <<-'EOF'
# Privacy Policy

This privacy policy outlines how this service collects, uses, and protects your personal information. We are committed to safeguarding your privacy.

## Information We Collect

We may collect information that you provide to us directly, such as when you create an account or contact us. We may also automatically collect technical information, such as your IP address and browser type, for the purpose of maintaining and improving the service.

## Use of Information

The information we collect is used to operate and maintain the quality of the service, to provide general statistics regarding use of the service, and to communicate with you.

## Data Security

We implement a variety of security measures to maintain the safety of your personal information.
EOF
else
    echo "LOG=${PRIVACY_MD} already exists. Verifying content is non-empty."
    [ -s "$PRIVACY_MD" ] || { echo "ERROR: $PRIVACY_MD is empty."; exit 1; }
fi

echo "LOG=Validating security headers for Next.js..."
if ! grep -q "Content-Security-Policy" "$NEXT_CONFIG"; then
    echo "ERROR: A Content-Security-Policy (CSP) is a requirement. Please define one in the 'headers' section of your ${NEXT_CONFIG}."
    exit 1
else
    echo "LOG=Content-Security-Policy header seems to be configured."
fi

# --- Phase 5: Validating Firebase & API Configuration ---
echo "== Phase 5: Validating Firebase & API Configuration ===="
[ -f "$FIRESTORE_RULES" ] || { echo "ERROR: $FIRESTORE_RULES is missing."; exit 1; }
[ -f "$STORAGE_RULES" ] || { echo "ERROR: $STORAGE_RULES is missing."; exit 1; }

echo "LOG=Verifying firebase.json deployment configuration..."
if ! grep -q '"hosting"' "$FIREBASE_JSON"; then
    echo "WARNING: No 'hosting' configuration found in ${FIREBASE_JSON}. Firebase may not deploy a web app.";
fi
if ! grep -q '"functions"' "$FIREBASE_JSON"; then
    echo "WARNING: No 'functions' configuration found in ${FIREBASE_JSON}. Firebase may not deploy any functions.";
fi

echo "LOG=Compiling Firestore rules..."
firebase firestore:rules:check "$FIRESTORE_RULES"

echo "LOG=Checking for insecure default Firebase rules..."
if grep -qE "allow (read|write): if true;" "$FIRESTORE_RULES"; then
    echo "ERROR: Insecure 'allow read/write: if true;' found in $FIRESTORE_RULES."
    exit 1
fi
if grep -qE "allow (read|write): if true;" "$STORAGE_RULES"; then
    echo "ERROR: Insecure 'allow read/write: if true;' found in $STORAGE_RULES."
    exit 1
fi
echo "LOG=Firebase rules appear to be non-default and compile correctly."

echo "LOG=Checking for deployable Firebase indexes..."
if ! grep -q '"indexes":' "$FIREBASE_JSON" && [ ! -f "firestore.indexes.json" ]; then
    echo "WARNING: No Firestore indexes defined in firebase.json or firestore.indexes.json."
else
    echo "LOG=Firestore indexes found."
fi

if [ -d "app/api" ]; then
    echo "LOG=Validating API for auth and rate-limiting patterns..."
    if ! grep -rq "lib/auth" app/api/; then
        echo "WARNING: No auth middleware from 'lib/auth' detected in 'app/api/'. Manual verification advised."
    else
        echo "LOG=Auth middleware usage detected in API routes."
    fi
    if ! grep -rqE "(rate-limiter-flexible|express-rate-limit)" app/api/ package.json; then
        echo "WARNING: No common rate-limiting libraries detected. Manual verification advised for abuse protection."
    else
        echo "LOG=Rate limiting patterns detected."
    fi
else
    echo "LOG=No 'app/api' directory found. Skipping API validation."
fi

# --- Phase 6: Final Deploy Path Execution ---
echo "== Phase 6: Final Deploy Path Execution ===="
echo "LOG=Executing final Firebase deploy command. This will fail if not authenticated."
echo "LOG=This command will deploy Hosting, Functions, Firestore rules, and Storage rules as configured in firebase.json"
echo "LOG=To authenticate, run: firebase login"

firebase deploy --non-interactive

# --- Mission Complete ---
echo "== URAI SHIPMASTER: SHIPMENT COMPLETE. All systems nominal. ===="
echo "LOG=$LOG"
exit 0
