# URAI Privacy Production Verification

Date: 2026-05-16T09:00:02Z

## Commands Run

```bash
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
nix shell nixpkgs#jdk17_headless -c bash -lc 'java -version && npm run test:emulators'
nix shell nixpkgs#jdk17_headless -c bash -lc 'bash scripts/verify-release.sh'
```

## Verification Log

```bash
/tmp/urai-privacy-verify-release.log
```

## Current Status

Local non-emulator checks passed through Next.js build. Emulator-backed tests and full release verification require Java through Nix.

## Production Status

NOT PRODUCTION READY until emulator tests pass, dependency audit is resolved or formally accepted, staging deploy evidence is recorded, production deploy evidence is recorded, legal review is complete, and docs/LOCK.md is created.
