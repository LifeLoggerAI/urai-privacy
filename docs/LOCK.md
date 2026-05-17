# URAI Privacy Production Release Evidence Lock

Status: **SYSTEM-OF-SYSTEMS CONTRACT MAPPED; NOT LOCKED FOR PRODUCTION**
Branch: `harden-release-verification`
Last updated: 2026-05-17

This file records the evidence required before `urai-privacy` can be called production-ready or used as the binding privacy control plane across the URAI ecosystem.

## Release candidate

- Repository: `LifeLoggerAI/urai-privacy`
- Branch: `harden-release-verification`
- Commit SHA: `b64a2e40ab98cfe297972dc69ad3523825ebf070` plus follow-on system-of-systems mapping commits on this branch
- Release version: `0.2.0-staging-scaffold`
- Firebase staging project: `TBD`
- Firebase production project: `TBD`
- Staging URL: `TBD`
- Production URL: `TBD`

## System-of-systems control-plane contract

The Tier-One URAI systems are now mapped to the `urai-privacy` control-plane contract in `privacy/system-of-systems/registry.json` and validated by `npm run audit:privacy`.

Contract status definitions:

- `control-plane-contract-mapped`: the repo has a required privacy adoption contract, data-domain mapping, and release evidence obligation recorded in the central registry.
- `live-adopted`: the downstream repo has implemented and verified the contract in code, staging, production, and release evidence.
- `waived`: an owner-approved dated exception exists with mitigation.

Current status is **contract mapped**, not live deployed or legally production locked.

## Required command evidence

Paste exact terminal output or CI artifact links below each gate.

### 1. Deterministic install

```txt
2026-05-17 local operator evidence: npm install and functions npm install completed after dependency hardening.
TBD: npm ci
TBD: npm ci --prefix functions
```

### 2. Static quality gates

```txt
2026-05-17 local operator evidence: lint, typecheck, unit tests, rules static validation, route smoke validation, and Tier-One audit passed during verify-release.
TBD: npm run audit:privacy after system-of-systems registry commit
```

### 3. Production build gates

```txt
2026-05-17 local operator evidence: Next production build, Functions build, and Functions typecheck passed during verify-release.
```

### 4. Firebase emulator behavioral gates

Firebase emulators require Java. Install OpenJDK/Temurin 17+ before running the full verifier.

```txt
2026-05-17 local operator evidence: Firestore/Storage rules tests passed; callable integration smoke tests passed under Firebase emulators during verify-release.
```

### 5. Security gate

```txt
2026-05-17 local operator evidence: security gate passed; root and functions npm audit showed 0 vulnerabilities.
```

### 6. Production readiness assertions

```txt
2026-05-17 local operator evidence: assert-production-ready passed; code release checks passed; live deploy still requires operator env/project verification.
```

### 7. Full release verifier

```txt
2026-05-17 local operator evidence: bash scripts/verify-release.sh ended with [verify-release] OK before push of b64a2e40ab98cfe297972dc69ad3523825ebf070.
TBD: rerun after system-of-systems registry/audit commits.
```

## Deployment evidence

### Staging

- Deployed by: `TBD`
- Deployed at: `TBD`
- Firebase project: `TBD`
- Hosting URL: `TBD`
- Functions region: `TBD`
- Smoke-tested routes:
  - `/`
  - `/privacy`
  - `/privacy-center`
  - `/privacy-center/export`
  - `/privacy-center/delete`
  - `/privacy-center/consent`
  - `/privacy-center/audit-log`
  - `/admin`
  - `/admin/privacy-requests`
  - `/admin/audit-log`

### Production

- Deployed by: `TBD`
- Deployed at: `TBD`
- Firebase project: `TBD`
- Hosting URL: `TBD`
- Functions region: `TBD`
- Smoke-tested routes: `TBD`

## Legal and governance approvals

Production launch remains blocked until qualified review is recorded.

- Privacy policy reviewed by: `TBD`
- Terms/legal notices reviewed by: `TBD`
- Data deletion workflow approved by: `TBD`
- Data export workflow approved by: `TBD`
- Incident response owner approved by: `TBD`
- Approval date: `TBD`

## Cross-repo adoption evidence

Each Tier-One URAI repo must prove adoption of the privacy control-plane rules before being called production-ready.

| Repo | Adoption status | Evidence |
|---|---|---|
| `LifeLoggerAI/UrAi` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/UrAiProd` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/urai-admin` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/urai-analytics` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/urai-communications` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/urai-studio` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/urai-spatial` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/urai-foundation` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/B2Bportal` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |
| `LifeLoggerAI/asset-factory` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy` |

## Production lock verdict

Current verdict: **BLOCKED FOR LIVE PRODUCTION; CONTRACT MAPPED FOR SYSTEM-OF-SYSTEMS ADOPTION**

Blocking items:

1. Full `bash scripts/verify-release.sh` output after system-of-systems mapping commits not recorded here.
2. Staging deployment evidence not recorded here.
3. Production deployment evidence not recorded here.
4. Legal/privacy governance approvals not recorded here.
5. Downstream repos have not yet recorded live-adopted implementation evidence.

Do not change this verdict to **LOCKED** until all evidence sections are complete or an explicit dated owner-approved exception is recorded.
