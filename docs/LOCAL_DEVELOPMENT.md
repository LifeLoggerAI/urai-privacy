# Local Development

## Requirements

- Node.js 20+
- npm 10+
- Python 3.11+
- Firebase CLI for emulator/deploy workflows

## App setup

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

## Existing governance validation

```bash
pip install -r requirements.txt
python tools/run_validation.py
```

## Release verification

```bash
bash scripts/verify-release.sh
```

The verifier runs npm install, lint, typecheck, tests, static Firebase rule checks, route smoke checks, Next.js build, and the existing Python governance validation.

## Firebase emulators

After installing Firebase CLI and configuring a local demo project:

```bash
firebase emulators:start
npm run test:emulators
```

The current `test:emulators` command runs static rules checks and integration tests. Full emulator-backed Auth/Firestore rule tests are still a remaining blocker before production readiness.

## Safety rules

Do not commit real `.env` files, `.firebaserc` with production project IDs, service account JSON, private keys, generated export packages, emulator data exports with user data, or Firebase Admin credentials.
