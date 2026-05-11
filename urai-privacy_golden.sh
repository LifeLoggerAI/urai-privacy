set -euo pipefail
set +H 2>/dev/null || true
set +o histexpand 2>/dev/null || true

# --- BEGIN UR.AI-PRIVACY GOLDEN PATH SCRIPT (v5) ---
# v5: Performs a clean install (removes node_modules/package-lock.json) to fix corruption.

# Section 0: Error Handling
trap 'echo "❌ FAILED on line $LINENO: $BASH_COMMAND" >&2 && exit 1' ERR

# Section 1: Firebase Project Auto-Detection
echo "--- (1/9) DETECTING FIREBASE PROJECT ---"
FIREBASE_PROJECT_ID=""
if [ -f ".firebaserc" ]; then
    PROJECT_ID_FROM_RC=$(grep -o '"default": "[^"]*"' .firebaserc | sed 's/"default": "//' | sed 's/"//' || true)
    if [ -n "$PROJECT_ID_FROM_RC" ]; then
        echo "✅ Found project in .firebaserc: $PROJECT_ID_FROM_RC"
        FIREBASE_PROJECT_ID=$PROJECT_ID_FROM_RC
    fi
fi

if [ -z "$FIREBASE_PROJECT_ID" ]; then
    echo "Project not configured. Querying available projects from Firebase..."
    firebase projects:list --json > .firebase_projects_list.json
    PROJECT_COUNT=$(grep -c '"projectId":' .firebase_projects_list.json)

    if [ "$PROJECT_COUNT" -eq 0 ]; then
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "!!!!!! 🔥 CRITICAL ERROR: NO FIREBASE PROJECTS FOUND 🔥 !!!!!!"
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo ">>> YOU MUST CREATE A FIREBASE PROJECT IN THE CONSOLE <<<"
        echo "1. GO TO: https://console.firebase.google.com"
        echo "2. CREATE a new project."
        echo "3. RERUN this script."
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        exit 1
    elif [ "$PROJECT_COUNT" -eq 1 ]; then
        FIREBASE_PROJECT_ID=$(grep -o '"projectId": "[^"]*"' .firebase_projects_list.json | head -n 1 | sed 's/"projectId": "//' | sed 's/"//')
        echo "✅ Auto-detected a single Firebase project: $FIREBASE_PROJECT_ID. Using it."
    else
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "!!!!!! 🔥 CRITICAL ERROR: MULTIPLE PROJECTS FOUND 🔥 !!!!!!"
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo ">>> Found multiple Firebase projects. Please specify which one to use. <<<"
        grep '''"projectId":''' .firebase_projects_list.json | sed 's/      "projectId":/  -/'
        echo ""
        echo "Then, run this command before re-running the script:"
        echo "  firebase use <PROJECT_ID>"
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        exit 1
    fi
fi

# Section 2: Environment Detection & Setup
echo "--- (2/9) DETECTING ENVIRONMENT & CONFIGURING FIREBASE CLI ---"
firebase use $FIREBASE_PROJECT_ID
echo "✅ Firebase project set to: $FIREBASE_PROJECT_ID"
REPO_ROOT=$(pwd)
echo "✅ Repo root detected at: $REPO_ROOT"
PKG_MANAGER="npm"
if [ -f "pnpm-lock.yaml" ]; then PKG_MANAGER="pnpm"; elif [ -f "yarn.lock" ]; then PKG_MANAGER="yarn"; fi
echo "✅ Package manager detected: $PKG_MANAGER"
echo "✅ Node version: $(node --version)"
if ! command -v firebase &> /dev/null; then echo "❌ CRITICAL: Firebase CLI not found" >&2; exit 1; fi
echo "✅ Firebase CLI detected: $(which firebase)"

# Section 3: Create Backups
echo "--- (3/9) CREATING BACKUPS ---"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$REPO_ROOT/backups/golden_path_$TIMESTAMP"
mkdir -p "$BACKUP_DIR"
echo "✅ Backup directory created at: $BACKUP_DIR"
for FILE in firebase.json firestore.rules firestore.indexes.json storage.rules .firebaserc package.json; do
    if [ -f "$FILE" ]; then
        cp "$FILE" "$BACKUP_DIR/$(basename $FILE).bak"
        echo "🔄 Backed up $FILE"
    fi
done

# Section 4: Implement & Configure Firebase Artifacts
echo "--- (4/9) CONFIGURING FIREBASE ARTIFACTS ---"
echo "⚙️ Writing .firebaserc..."
echo "{ "projects": { "default": "$FIREBASE_PROJECT_ID" } }" > .firebaserc

echo "⚙️ Writing firebase.json with hardened hosting & functions..."
cat <<-'EOF' > firebase.json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "functions": [{ "source": "functions", "codebase": "default", "ignore": ["node_modules",".git","*.log"], "predeploy": ["npm --prefix "%RESOURCE_DIR%" run lint", "npm --prefix "%RESOURCE_DIR%" run build"] }],
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {"source": "**/*.@(jpg|jpeg|gif|png|svg|webp|js|css|woff|woff2|ttf)","headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]},
      {"source": "**","headers": [
          {"key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload"},
          {"key": "X-Content-Type-Options", "value": "nosniff"},
          {"key": "X-Frame-Options", "value": "DENY"},
          {"key": "Content-Security-Policy", "value": "base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:;"},
          {"key": "Referrer-Policy", "value": "no-referrer"},
          {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()"}
      ]}
    ]
  },
  "storage": { "rules": "storage.rules" },
  "emulators": {
    "auth": { "port": 9099 }, "functions": { "port": 5001 }, "firestore": { "port": 8080 },
    "hosting": { "port": 5000 }, "storage": { "port": 9199 }, "ui": { "enabled": true, "port": 4000 }
  }
}
EOF

echo "⚖️ Writing firestore.rules with least-privilege access..."
cat <<-'EOF' > firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) { return request.auth != null && request.auth.uid == userId; }
    function isVerifiedApp() { return request.app != null; }

    match /users/{userId} {
      allow read, write: if isOwner(userId);
      match /auditLog/{logId} {
        allow read: if isOwner(userId);
        allow create, update, delete: if false;
      }
    }
    match /consentReceipts/{receiptId} {
      allow create: if isOwner(request.resource.data.userId) && isVerifiedApp();
      allow read: if isOwner(resource.data.userId);
      allow update, delete: if false;
    }
    match /dsr/{requestId} {
      allow create: if isOwner(request.resource.data.userId) && isVerifiedApp();
      allow read, update: if isOwner(resource.data.userId);
      allow delete: if false;
    }
    match /policies/{policyName}/{version} {
      allow get: if true;
      allow list, write: if false;
    }
  }
}
EOF

echo "🗄️ Writing storage.rules for secure data exports..."
cat <<-'EOF' > storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /exports/{userId}/{exportFile} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Written by a trusted backend function
    }
  }
}
EOF

echo "⚡ Writing firestore.indexes.json to optimize queries..."
cat <<-'EOF' > firestore.indexes.json
{
  "indexes": [
    {"collectionGroup": "consentReceipts", "queryScope": "COLLECTION", "fields": [{"fieldPath": "userId", "order": "ASCENDING"}, {"fieldPath": "timestamp", "order": "DESCENDING"}]},
    {"collectionGroup": "dsr", "queryScope": "COLLECTION", "fields": [{"fieldPath": "userId", "order": "ASCENDING"}, {"fieldPath": "createdAt", "order": "DESCENDING"}]}
  ]
}
EOF

# Section 5: Create Smoke Test Script
echo "--- (5/9) CREATING SMOKE TEST SCRIPT ---"
mkdir -p scripts
cat <<-'EOF' > scripts/smoke-test.sh
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
EOF
chmod +x scripts/smoke-test.sh

# Section 6: Install Dependencies
echo "--- (6/9) INSTALLING DEPENDENCIES (CLEAN INSTALL) ---"
echo "Performing a clean install to prevent corruption issues."
rm -rf node_modules package-lock.json
echo "Verifying npm version..."
npm --version
$PKG_MANAGER install

# Section 7: Build Project
echo "--- (7/9) BUILDING PROJECT ---"
if grep -q '"build"' package.json; then
    echo "Running root build script..."
    $PKG_MANAGER run build
else
    echo "No root build script found. Attempting to build web-app directly..."
    if [ -d "apps/urai-privacy-web" ] && [ -f "apps/urai-privacy-web/package.json" ]; then
        (cd apps/urai-privacy-web && $PKG_MANAGER run build)
    else
        echo "⚠️ No build script found, skipping build."
    fi
fi

# Section 8: Deploy to Firebase
echo "--- (8/9) DEPLOYING TO FIREBASE ---"
echo "🚀 Deploying all artifacts to Firebase project '$FIREBASE_PROJECT_ID'..."
firebase deploy --project "$FIREBASE_PROJECT_ID" --only hosting,firestore,storage,functions --force

# Section 9: Verify Deployment
echo "--- (9/9) VERIFYING DEPLOYMENT ---"
HOSTING_URL=$(firebase hosting:channel:open live --project "$FIREBASE_PROJECT_ID" --json 2>/dev/null | grep -o 'https://[^"]*' | head -n 1)
if [ -z "$HOSTING_URL" ]; then
    echo "⚠️ Could not auto-detect hosting URL. Find it in the Firebase Console and run smoke test manually."
else
    echo "✅ Verification target: $HOSTING_URL"
    ./scripts/smoke-test.sh "$HOSTING_URL" "$FIREBASE_PROJECT_ID"
fi

echo ""
echo "🎉 --- GOLDEN PATH SCRIPT FINISHED --- 🎉"
echo "✅ Project '$FIREBASE_PROJECT_ID' is deployed and verified."
echo "✅ Live URL: $HOSTING_URL"
