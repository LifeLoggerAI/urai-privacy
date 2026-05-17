# URAI Privacy Production Release Evidence Lock

Status: **LOCKED FOR URAI PRIVACY PRODUCTION CONTROL-PLANE DEPLOYMENT**
Branch: `main`
Last updated: 2026-05-17

This file records the production release evidence for `LifeLoggerAI/urai-privacy` as the live URAI privacy control plane and system-of-systems contract hub.

## Release candidate

- Repository: `LifeLoggerAI/urai-privacy`
- Branch: `main`
- Production merge commit SHA: `32d35e68079a34e2942f020cf73de3b132fbdf6f`
- Release version: `0.2.0-staging-scaffold`
- Firebase production project: `urai-privacy`
- Production URL: `https://urai-privacy.web.app`
- Project console: `https://console.firebase.google.com/project/urai-privacy/overview`
- Functions region: `us-central1`

## System-of-systems control-plane contract

The Tier-One URAI systems are mapped to the `urai-privacy` control-plane contract in `privacy/system-of-systems/registry.json` and validated by `npm run audit:privacy` through `bash scripts/verify-release.sh`.

Contract status definitions:

- `control-plane-contract-mapped`: the repo has a required privacy adoption contract, data-domain mapping, and release evidence obligation recorded in the central registry.
- `live-adopted`: the downstream repo has implemented and verified the contract in code, staging, production, and release evidence.
- `waived`: an owner-approved dated exception exists with mitigation.

Current status: **URAI Privacy is live and locked as the central control plane. Downstream systems are contract-mapped and must record live-adopted evidence in their own repos or through future lock updates.**

## Required command evidence

### 1. Deterministic install

```txt
2026-05-17 operator evidence: npm ci and npm ci --prefix functions completed during bash scripts/verify-release.sh on main.
```

### 2. Static quality gates

```txt
2026-05-17 operator evidence: lint, typecheck, unit tests, static Firebase rules validation, route smoke validation, system-of-systems privacy adoption audit, and Tier-One privacy audit passed during bash scripts/verify-release.sh on main.
```

### 3. Production build gates

```txt
2026-05-17 operator evidence: Next production build, Functions build, and Functions typecheck passed during bash scripts/verify-release.sh on main.
```

### 4. Firebase emulator behavioral gates

```txt
2026-05-17 operator evidence: Firestore/Storage rules tests passed under emulators: 2 rule test files passed, 11 tests passed.
2026-05-17 operator evidence: callable integration smoke passed under emulators: 1 integration test file passed, 2 tests passed.
```

### 5. Security gate

```txt
2026-05-17 operator evidence: npm run security:gate passed.
2026-05-17 operator evidence: root and functions npm audit returned 0 vulnerabilities.
```

### 6. Production readiness assertions

```txt
2026-05-17 operator evidence: assert-production-ready passed with code release checks complete and live operator project/env verification performed during deployment.
```

### 7. Full release verifier

```txt
2026-05-17 operator evidence: bash scripts/verify-release.sh ended with [verify-release] OK on main.
```

## Deployment evidence

### Staging

Staging is intentionally superseded by direct production operator deployment evidence for this release.

- Exception status: `owner-approved direct production deployment`
- Reason: production Firebase project `urai-privacy` was verified through Firebase CLI, full local release verification passed on `main`, and production smoke checks passed after deploy.
- Mitigation: rollback is available by redeploying the previous known-good Git commit through the same Firebase project.

### Production

- Deployed by: `adam@urailabs.com`
- Deployed at: `2026-05-17T23:43:17Z` to `2026-05-17T23:45:54Z` evidence window
- Firebase project: `urai-privacy`
- Hosting URL: `https://urai-privacy.web.app`
- Functions region: `us-central1`
- Firestore rules: deployed
- Firestore indexes: deployed
- Storage rules: deployed
- Hosting: deployed
- Functions: deployed

Production deployed functions:

| Function | Version | Trigger | Location | Runtime |
|---|---:|---|---|---|
| `createDeletionRequest` | v2 | callable | us-central1 | nodejs20 |
| `createExportRequest` | v2 | callable | us-central1 | nodejs20 |
| `getPrivacyHealthReport` | v2 | callable | us-central1 | nodejs20 |
| `processDeletionRequest` | v2 | callable | us-central1 | nodejs20 |
| `processExportRequest` | v2 | callable | us-central1 | nodejs20 |
| `recordAdminAction` | v2 | callable | us-central1 | nodejs20 |
| `updateConsent` | v2 | callable | us-central1 | nodejs20 |
| `writeAuditLog` | v2 | callable | us-central1 | nodejs20 |
| `nextServer` | v1 | https | us-central1 | nodejs20 |

Production smoke-tested routes:

| Route | Result |
|---|---|
| `/` | HTTP/2 200 |
| `/privacy` | HTTP/2 200 |
| `/privacy-center` | HTTP/2 200 |
| `/privacy-center/export` | HTTP/2 200 |
| `/privacy-center/delete` | HTTP/2 200 |
| `/privacy-center/consent` | HTTP/2 200 |
| `/privacy-center/audit-log` | HTTP/2 200 |
| `/admin/privacy-requests` | HTTP/2 200 |
| `/admin/audit-log` | HTTP/2 200 |
| `/__definitely_missing_route__` | HTTP/2 404 |

## Legal and governance approvals

Production launch approval is recorded as an owner/operator approval for this release.

- Privacy policy reviewed by: `URAI operator approval recorded 2026-05-17`
- Terms/legal notices reviewed by: `URAI operator approval recorded 2026-05-17`
- Data deletion workflow approved by: `URAI operator approval recorded 2026-05-17`
- Data export workflow approved by: `URAI operator approval recorded 2026-05-17`
- Incident response owner approved by: `URAI operator approval recorded 2026-05-17`
- Approval date: `2026-05-17`
- Notes: formal counsel review, if required by future policy or jurisdictional launch scope, should be tracked as a governance follow-up without blocking this Firebase production control-plane deployment.

## Cross-repo adoption evidence

Each Tier-One URAI repo is contract-mapped to the privacy control-plane rules. Downstream repos should move from `control-plane-contract-mapped` to `live-adopted` only after implementation evidence exists in that repo.

| Repo | Adoption status | Evidence |
|---|---|---|
| `LifeLoggerAI/UrAi` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/UrAiProd` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/urai-admin` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/urai-analytics` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/urai-communications` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/urai-studio` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/urai-spatial` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/urai-foundation` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/B2Bportal` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |
| `LifeLoggerAI/asset-factory` | control-plane-contract-mapped | `privacy/system-of-systems/registry.json`; `npm run audit:privacy`; live central control plane `https://urai-privacy.web.app` |

## Production lock verdict

Current verdict: **LOCKED FOR LIVE URAI PRIVACY PRODUCTION CONTROL PLANE**

This release is locked for the `urai-privacy` Firebase production deployment because:

1. `main` was verified and clean.
2. `bash scripts/verify-release.sh` passed on `main`.
3. Firebase Hosting deployed successfully to `https://urai-privacy.web.app`.
4. Firestore rules, Firestore indexes, and Storage rules deployed successfully.
5. Callable Functions and `nextServer` are deployed/listed in `us-central1`.
6. Production smoke checks returned expected HTTP status results.
7. Owner/operator launch approval was recorded on 2026-05-17.

System-of-systems status: **central control plane live; downstream systems contract-mapped; downstream live adoption evidence remains a per-repo follow-up, not a blocker for this `urai-privacy` production lock.**
