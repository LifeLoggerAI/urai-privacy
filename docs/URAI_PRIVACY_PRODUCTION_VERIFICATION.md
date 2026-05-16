# URAI Privacy Production Verification

Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Commands Run

```bash
npm install
npm install --prefix functions
npm install -D firebase-admin
npm run lint
npm run typecheck
npm run test:unit
npm run test:rules:static
npm run test:e2e
npm run build
npm --prefix functions run build
npm --prefix functions run typecheck
firebase emulators:exec --project urai-privacy-integration-test --only auth,firestore,storage,functions "npm run test:emulators"
bash scripts/verify-release.sh
cd urai-privacy

# Install Java for Firebase emulators
if command -v apt >/dev/null 2>&1; then
  sudo apt update
  sudo apt install -y openjdk-17-jdk
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y java-17-openjdk-devel
elif command -v yum >/dev/null 2>&1; then
  sudo yum install -y java-17-openjdk-devel
elif command -v brew >/dev/null 2>&1; then
  brew install openjdk@17
  echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
fi

java -version

# Re-run emulator-backed tests
firebase emulators:exec --project urai-privacy-integration-test --only auth,firestore,storage,functions "npm run test:emulators"

# Re-run full release verifier
bash scripts/verify-release.sh 2>&1 | tee /tmp/urai-privacy-verify-release.log

# Optional vulnerability pass
npm audit
npm audit fix

# Re-run after audit fix
npm run lint
npm run typecheck
npm run test:unit
npm run test:rules:static
npm run test:e2e
npm run build
npm --prefix functions run build
npm --prefix functions run typecheck
firebase emulators:exec --project urai-privacy-integration-test --only auth,firestore,storage,functions "npm run test:emulators"

# Record verification evidence
cat > docs/URAI_PRIVACY_PRODUCTION_VERIFICATION.md <<EOF
# URAI Privacy Production Verification

Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Commands Run

\`\`\`bash
npm install
npm install --prefix functions
npm run lint
npm run typecheck
npm run test:unit
npm run test:rules:static
npm run test:e2e
npm run build
npm --prefix functions run build
npm --prefix functions run typecheck
firebase emulators:exec --project urai-privacy-integration-test --only auth,firestore,storage,functions "npm run test:emulators"
bash scripts/verify-release.sh
npm audit
npm audit fix
\`\`\`

## Verification Log

Local log:

\`\`\`bash
/tmp/urai-privacy-verify-release.log
\`\`\`

## Production Status

NOT PRODUCTION READY until emulator tests pass, dependency audit is acceptable, staging deploy evidence is recorded, production deploy evidence is recorded, legal review is complete, and docs/LOCK.md is created.
