# URAI Privacy Production Release Evidence Lock

Status: **LOCKED FOR URAI PRIVACY PRODUCTION CONTROL-PLANE DEPLOYMENT**
Branch: `main`
Last updated: 2026-05-19

This file records the production release evidence for `LifeLoggerAI/urai-privacy` as the URAI privacy control plane and system-of-systems contract hub.

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

Current status: **URAI Privacy is the central control plane. Downstream systems are contract-mapped and must record live-adopted evidence in their own repos or through future lock updates before being treated as fully live-adopted.**

## Tier-One cross-repo adoption rows

These rows are intentionally explicit because `npm run audit:privacy` requires every Tier-One system to appear in this release lock. The source of truth for controls, data domains, and release obligations remains `privacy/system-of-systems/registry.json`.

| Repo | Current status | Required release evidence |
| --- | --- | --- |
| `LifeLoggerAI/UrAi` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/UrAiProd` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/urai-admin` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/urai-analytics` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/urai-communications` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/urai-studio` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/urai-spatial` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/urai-foundation` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/B2Bportal` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |
| `LifeLoggerAI/asset-factory` | `control-plane-contract-mapped` | Must satisfy consent, export, deletion, retention, audit, admin access, data minimization, and incident response adoption evidence before live-adopted status. |

## Required command evidence

### 1. Deterministic install

```txt
2026-05-17 operator evidence: npm ci and npm ci --prefix functions completed during bash scripts/verify-release.sh on main.
```

### 2. Release verifier

```bash
npm run verify:release
```

The verifier must pass deterministic install, lint, typecheck, unit tests, static rules validation, route smoke, system-of-systems privacy adoption audit, Tier-One audit, build, functions checks, emulator-backed rules/integration tests, security gate, production readiness assertions, and optional live smoke.

### 3. Staging evidence gate

```bash
URAI_PRIVACY_REQUIRE_LIVE=1 npm run release:evidence:staging
```

Generated staging evidence must be reviewed before any live deployment claim is accepted. Do not commit secrets or private operator evidence to this file.

## External gates still requiring live evidence

- Firebase staging/prod credentials and deployment proof.
- Admin custom-claim proof in live Firebase.
- Live smoke evidence for export, signed download, deletion, consent, admin denied, and admin allowed flows.
- Legal/privacy approval.
- Monitoring and rollback proof.
- Current npm audit disposition.
