#!/usr/bin/env bash
# URAI SHIPMASTER — FIREBASE STUDIO SHIP & LOCK SCRIPT
# MISSION: urai-privacy. CLEAN. LIVE. LOCKED.
# ID: 20260131_004003

# Strict Mode: Exit on error, unset variable, or pipe failure.
set -euo pipefail

# --- Globals & Content Definitions ---
readonly TS="$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="/tmp/urai_privacy_ship_lock.${TS}.log"
readonly PROJECT_ID="urai-privacy"
REPO_ROOT=""
EMULATOR_PIDS=""

# --- HEREDOC CONTENT: Pre-defined file contents for scaffolding ---

read -r -d \'\' LAYOUT_TSX_CONTENT <<\'EOF\'
import React from 'react';
// A clean, minimal layout for legal and privacy pages.
export const LegalLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`, padding: '2rem 4rem', maxWidth: '800px', margin: '4rem auto', color: '#333' }}>
    <header style={{ borderBottom: '1px solid #eaeaea', paddingBottom: '1rem', marginBottom: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: '600', letterSpacing: '-0.05em' }}>{title}</h1>
    </header>
    <main style={{ fontSize: '1.1rem', lineHeight: '1.7' }}>
      {children}
    </main>
    <footer style={{ marginTop: '4rem', paddingTop: '1rem', borderTop: '1px solid #eaeaea', textAlign: 'center', fontSize: '0.9rem', color: '#999' }}>
      <p>&copy; 2026 URAI. All rights reserved.</p>
    </footer>
  </div>
);
EOF

read -r -d \'\' PRIVACY_PAGE_CONTENT <<\'EOF\'
import { LegalLayout } from '../../_components/LegalLayout';
export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>This Privacy Policy describes Our policies and procedures on the collection, use, and disclosure of Your information when You use the Service. We use Your Personal data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy.</p>
      <h2>Collecting and Using Your Personal Data</h2>
      <p>While using Our Service, We may ask You to provide Us with certain personally identifiable information that can be used to contact or identify You. This may include, but is not limited to: Email address, Usage Data, and information you voluntarily provide.</p>
      <h2>Your Rights</h2>
      <p>You have the right to delete or request that We assist in deleting the Personal Data that We have collected about You. Our Service provides you with the ability to delete certain information about You from within the Service. You may also contact us to request access to, correct, or delete any personal information that you have provided to us.</p>
    </LegalLayout>
  );
}
EOF

read -r -d \'\' TERMS_PAGE_CONTENT <<\'EOF\'
import { LegalLayout } from '../../_components/LegalLayout';
export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>By accessing this website, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
      <h2>Use License</h2>
      <p>Permission is granted to temporarily download one copy of the materials on this website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.</p>
      <h2>Disclaimer</h2>
      <p>The materials on this website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
    </LegalLayout>
  );
}
EOF

read -r -d \'\' PRIVACY_CENTER_PAGE_CONTENT <<\'EOF\'
import { LegalLayout } from '../../_components/LegalLayout';
export default function PrivacyCenterPage() {
  return (
    <LegalLayout title="Privacy Center">
      <p>Welcome to your Privacy Center. Here you can manage your privacy preferences, request a download of your data, or request account deletion. Full functionality for these actions requires authentication and will be enabled upon user login.</p>
      <div>
        <h3>Manage Your Data</h3>
        <button disabled style={{ marginRight: '1rem', padding: '0.5rem 1rem' }}>Download My Data</button>
        <button disabled style={{ padding: '0.5rem 1rem' }}>Delete My Account</button>
      </div>
    </LegalLayout>
  );
}
EOF

read -r -d \'\' FIRESTORE_RULES_CONTENT <<\'EOF\'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return exists(/databases/$(database)/documents/adminAllowlist/$(request.auth.uid));
    }
    match /consentRecords/{uid}/{versionId} {
      allow read, write: if request.auth.uid == uid;
    }
    match /privacyRequests/{reqId} {
      allow create: if request.auth.uid == request.resource.data.uid;
      allow read: if request.auth.uid == resource.data.uid || isAdmin();
      allow update, delete: if false;
    }
    match /contactMessages/{msgId} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }
    match /auditLogs/{logId} {
      allow read, write: if isAdmin();
    }
    match /adminAllowlist/{uid} {
      allow read, write: if false;
    }
  }
}
EOF

read -r -d \'\' FUNCTIONS_INDEX_TS_CONTENT <<\'EOF\'
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const requestDataExport = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
  }
  const ref = await db.collection("privacyRequests").add({
    uid,
    type: "EXPORT",
    status: "PENDING",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { status: "queued", requestId: ref.id };
});

export const requestAccountDeletion = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
  }
  const ref = await db.collection("privacyRequests").add({
    uid,
    type: "DELETE",
    status: "PENDING",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { status: "queued", requestId: ref.id };
});

export const contactForm = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  const { email, message } = req.body;
  if (!email || !message) {
    res.status(400).send("Bad Request: Email and message are required.");
    return;
  }
  await db.collection("contactMessages").add({
    email,
    message,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ipAddress: req.ip,
  });
  res.status(200).json({ status: "received" });
});
EOF


# --- Primitives: Core utilities for logging, error handling, and backups ---
log() { echo "LOG: $1"; }
die() { echo "ERROR: $1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Required command '$1' not found. Install it and retry."; }
bak() { [ -f "$1" ] && cp -f "$1" "$1.bak.${TS}" && log "Backed up '$1' -> '$1.bak.${TS}'"; }

# --- Trap: Ensure clean shutdown on exit or error ---
cleanup() {
  log "Executing cleanup..."
  if [ -n "$EMULATOR_PIDS" ]; then
    log "Stopping Firebase emulator processes: $EMULATOR_PIDS"
    kill -9 $EMULATOR_PIDS 2>/dev/null && wait $EMULATOR_PIDS 2>/dev/null || log "Emulators already stopped."
  fi
  log "Cleanup complete. Full log at: ${LOG_FILE}"
}
trap cleanup EXIT SIGINT SIGTERM

# --- Main Execution Phases ---

discover_repo() {
    log "--- (1/7) DISCOVERING REPO ---"
    local search_path="/home/user"
    local preferred_path="${search_path}/${PROJECT_ID}"
    if [ -d "$preferred_path" ] && [ -f "$preferred_path/firebase.json" ]; then
        REPO_ROOT="$preferred_path"
    else
        log "Preferred path not found, searching for .firebaserc..."
        local firebaserc_path
        firebaserc_path=$(find "${search_path}" -maxdepth 3 -name ".firebaserc" -print0 2>/dev/null | xargs -0 grep -l "\"${PROJECT_ID}\"" || true)
        [ -n "$firebaserc_path" ] && REPO_ROOT=$(dirname "$firebaserc_path") || die "Could not find repo root for project '${PROJECT_ID}'."
    fi
    cd "${REPO_ROOT}"
    log "✅ Repo root validated: $(pwd)"
}

verify_environment() {
    log "--- (2/7) VERIFYING ENVIRONMENT & FIREBASE ACCESS ---"
    need node; need pnpm; need firebase; need jq; need npx; need git
    local node_major; node_major=$(node -v | sed -E 's/v([0-9]+).*/\\1/')
    [ "$node_major" -eq 20 ] || die "Node.js v20.x is required, but found $(node -v)."

    if [ ! -f ".firebaserc" ] || ! grep -q "\"default\":\"${PROJECT_ID}\"" .firebaserc; then
        log "Configuring .firebaserc to use project '${PROJECT_ID}'."
        bak ".firebaserc"; printf '{"projects":{"default":"%s"}}\n' "${PROJECT_ID}" > .firebaserc
    fi

    log "Verifying Firebase project access..."
    local firebase_output
    if ! firebase_output=$(firebase projects:list --json 2>&1); then
        die $"Firebase CLI command failed when trying to list projects. Please ensure you are logged in ('firebase login') and have network access. CLI Output:\n---\n${firebase_output}\n---"
    fi
    if ! echo "${firebase_output}" | jq -e '.result[] | select(.projectId == "'"$PROJECT_ID"'")' > /dev/null; then
        die $"Firebase project '${PROJECT_ID}' not found in your list of accessible projects. Please check the project name and your permissions. CLI Output:\n---\n${firebase_output}\n---"
    fi
    firebase use "${PROJECT_ID}" --project "${PROJECT_ID}"
    log "✅ Toolchain and Firebase project access confirmed."
}

install_build_and_scaffold() {
    log "--- (3/7) INSTALL, BUILD, & SCAFFOLD ---"
    [ -d "packages" ] && [ ! -f "pnpm-workspace.yaml" ] && printf "packages:\n  - 'packages/*'\n  - 'functions'\n" > pnpm-workspace.yaml
    log "Installing dependencies with pnpm..."
    pnpm install

    local app_dir="app"
    if [ -d "$app_dir" ]; then
        log "Scaffolding missing pages and components..."
        local components_dir="${app_dir}/_components"
        mkdir -p "${app_dir}/privacy" "${app_dir}/terms" "${app_dir}/privacy-center" "${components_dir}"
        echo "${LAYOUT_TSX_CONTENT}" > "${components_dir}/LegalLayout.tsx"
        echo "${PRIVACY_PAGE_CONTENT}" > "${app_dir}/privacy/page.tsx"
        echo "${TERMS_PAGE_CONTENT}" > "${app_dir}/terms/page.tsx"
        echo "${PRIVACY_CENTER_PAGE_CONTENT}" > "${app_dir}/privacy-center/page.tsx"
    fi

    log "Hardening and validating Firestore rules..."
    bak "firestore.rules"; echo "${FIRESTORE_RULES_CONTENT}" > "firestore.rules"
    firebase --project "${PROJECT_ID}" firestore:rules:check "firestore.rules"

    log "Scaffolding and building Firebase Functions..."
    local fn_dir="functions"
    if [ ! -d "$fn_dir" ]; then
      firebase init functions --project "${PROJECT_ID}" --non-interactive
    fi
    (cd "$fn_dir" && pnpm install firebase-functions@latest firebase-admin@latest && pnpm add -D typescript)
    bak "$fn_dir/src/index.ts"; echo "${FUNCTIONS_INDEX_TS_CONTENT}" > "$fn_dir/src/index.ts"
    (cd "$fn_dir" && npx tsc)
    
    log "Running project build..."
    if [ -f "package.json" ] && grep -q '"build"' package.json; then
      pnpm run build
    else
      log "No top-level 'build' script found, skipping."
    fi
    
    log "✅ Project built and scaffolded successfully."
}

run_emulators_and_test() {
    log "--- (4/7) EMULATOR SMOKE TESTS ---"
    log "Starting Firebase emulators in background..."
    firebase emulators:start --project "${PROJECT_ID}" --host 127.0.0.1 --only hosting,firestore,functions,auth &
    EMULATOR_PIDS=$!
    log "Waiting for emulators to start (PID: $EMULATOR_PIDS)..."
    
    local wait_time=60; local end_time=$((SECONDS + wait_time)); local ready=false
    while [ $SECONDS -lt $end_time ]; do
      if curl -sSf http://127.0.0.1:4000/ >/dev/null 2>&1 && curl -sSf http://127.0.0.1:5001/ >/dev/null 2>&1; then
        log "✅ Emulators are responsive."; ready=true; break
      fi
      sleep 5
    done
    [ "$ready" = true ] || die "Emulators did not start within ${wait_time} seconds."

    log "Running smoke tests against emulators..."
    local host_port=5000
    if [ -f "firebase.json" ]; then
      host_port=$(jq '.emulators.hosting.port' firebase.json)
    fi

    curl -sSf "http://127.0.0.1:${host_port}/privacy" | grep -q "Privacy Policy" || die "Smoke Test FAIL: Hosting emulator check for /privacy failed."
    curl -sSf -X POST -H "Content-Type: application/json" -d '{"email":"test@example.com","message":"test"}' "http://127.0.0.1:5001/${PROJECT_ID}/us-central1/contactForm" | grep -q "received" || die "Smoke Test FAIL: Functions emulator check for contactForm failed."
    log "✅ Emulator smoke tests passed."
    
    log "Stopping emulators..."
    kill -9 $EMULATOR_PIDS; wait $EMULATOR_PIDS 2>/dev/null || true; EMULATOR_PIDS=""
}

harden_and_deploy() {
    log "--- (5/7) HARDENING & DEPLOYMENT ---"
    log "Scanning for secrets before deployment..."
    if git ls-files | xargs -I{} grep -E 'SECRET|KEY|TOKEN' --exclude-dir=node_modules --exclude=pnpm-lock.yaml {} && [ $? -ne 1 ]; then
      die "Potential secret found in the codebase. Please review and remove before deploying."
    fi

    log "Updating firebase.json for deployment..."
    bak "firebase.json"
    local tmp_json="firebase.tmp.json"
    local hosting_public_dir="out"
    if [ -d ".next" ]; then hosting_public_dir=".next"; fi
    
    local csp="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none';"
    jq --arg csp "$csp" --arg public_dir "$hosting_public_dir" '
      .hosting.public = $public_dir |
      .functions.source = "functions" |
      .hosting.headers = ([
        {"key":"Strict-Transport-Security","value":"max-age=31536000; includeSubDomains; preload"},
        {"key":"X-Content-Type-Options","value":"nosniff"},
        {"key":"X-Frame-Options","value":"DENY"},
        {"key":"Referrer-Policy","value":"no-referrer"},
        {"key":"Permissions-Policy","value":"camera=(), microphone=(), geolocation=()"},
        {"key":"Content-Security-Policy","value":$csp}
      ] + (.hosting.headers // [] | map(select(.key | IN("Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy") | not))))
    ' firebase.json > "$tmp_json" && mv "$tmp_json" firebase.json

    log "🚀 Deploying to Firebase: Hosting, Functions, Firestore Rules..."
    firebase deploy --project "${PROJECT_ID}" --non-interactive --only hosting,firestore,functions
    log "✅ DEPLOYMENT COMPLETE."
}

validate_and_lock() {
    log "--- (6/7) POST-DEPLOY VALIDATION & LOCK FILE ---"
    pnpm add -D playwright @playwright/test

    local deployed_url; deployed_url=$(firebase hosting:channel:list --project "${PROJECT_ID}" --json | jq -r '.result.channels[] | select(.name == "live") | .url')
    [ -n "$deployed_url" ] || die "Could not determine deployed URL for 'live' channel."
    log "Live site URL: $deployed_url"

    log "Running Playwright smoke test against live URL..."
    read -r -d '' e2e_spec_content <<EOF
import { test, expect } from '@playwright/test';
test('Live Privacy Page Health Check', async ({ page }) => {
  const response = await page.goto('/privacy');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('Privacy Policy');
  console.log('Live privacy page content verified.');
});
EOF
    echo "${e2e_spec_content}" > "e2e-live.spec.ts"
    npx playwright test --reporter=list --config=<(printf "module.exports = { use: { baseURL: '%s' } };" "$deployed_url") e2e-live.spec.ts
    
    local screenshot_path="/tmp/urai_privacy_live_${TS}.png"
    npx playwright screenshot "${deployed_url}/privacy" "${screenshot_path}"
    log "✅ Live URL screenshot saved to ${screenshot_path}"

    log "Generating Lock File..."
    local git_hash; git_hash=$(git rev-parse --short HEAD || echo "N/A")
    local hosting_public_dir="out"
    if [ -d ".next" ]; then hosting_public_dir=".next"; fi
    cat > "URAI_PRIVACY_LOCK.md" <<-EOF
# 🔐 URAI PRIVACY LOCK FILE

- **Timestamp:** ${TS}
- **Project ID:** ${PROJECT_ID}
- **Git Commit:** \`${git_hash}\`
- **Primary Website:** ${deployed_url}
- **Canary Command:** \`bash $(basename "$0")\`

---

## ✅ Validation Checklist
- [x] **Repo Discovery:** Repo found at \`${REPO_ROOT}\`
- [x] **Environment:** Node v$(node -v), pnpm v$(pnpm -v), Firebase CLI v$(firebase --version)
- [x] **Build & Scaffold:** Project dependencies installed, built, and scaffolded.
- [x] **Emulator Tests:** Hosting and Functions emulators passed smoke tests.
- [x] **Deployment:** Hosting, Functions, and Rules deployed to project \`${PROJECT_ID}\`.
- [x] **Live Validation:** Playwright test passed against live URL.

##  Deployed Artifacts

### Hosting
- **URL:** ${deployed_url}
- **Public Directory:** \`${hosting_public_dir}\`
- **Key Pages:** \`/privacy\`, \`/terms\`, \`/privacy-center\`

### Functions
- \`requestDataExport\` (Callable)
- \`requestAccountDeletion\` (Callable)
- \`contactForm\` (HTTPS)

### Firestore Rules
- Secure-by-default rules deployed. Users can only access their own data.

---
*This file was automatically generated. Do not edit manually.*
EOF
    log "✅ Lock file generated: URAI_PRIVACY_LOCK.md"
}

# --- Main Execution Block ---
main() {
    exec > >(tee -a "${LOG_FILE}") 2>&1
    log "--- URAI Privacy Ship & Lock Initialized ---"
    discover_repo
    verify_environment
    install_build_and_scaffold
    run_emulators_and_test
    harden_and_deploy
    validate_and_lock
    log "--- (7/7) MISSION COMPLETE ---"
    log "DONE"
}

main
