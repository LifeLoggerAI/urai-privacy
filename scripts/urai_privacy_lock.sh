#!/bin/bash
set -euo pipefail

LOG_FILE="/tmp/urai_privacy_lock_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "--- URAI Privacy Lock Script ---"

# Verify Tools
echo "Verifying required tools..."
command -v node >/dev/null 2>&1 || { echo >&2 "node not found"; exit 1; }
command -v corepack >/dev/null 2>&1 || { echo >&2 "corepack not found"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "npm run not found, enabling via corepack"; corepack enable; }
command -v firebase >/dev/null 2>&1 || { echo >&2 "firebase not found"; exit 1; }
echo "All tools are available."

# Install, build, and test
echo "Running install, lint, typecheck, test, and build..."
npm install
npm run lint
npm run typecheck
npm run test
npm run build
echo "All steps passed."

# Deploy
echo "Deploying to Firebase..."
firebase deploy --only hosting,firestore
echo "Deployment successful."

# Summary
echo "--- Deployment Summary ---"
echo "Log file: ${LOG_FILE}"
echo "Firebase project: $(firebase projects:list | grep "urai-privacy" | awk '{print $4}')"
echo "Hosting URL: $(firebase open hosting:site --json | jq -r .result.url)"
