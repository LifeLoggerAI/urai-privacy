# URAI Privacy Production Release Evidence Lock

Status: **NOT LOCKED FOR PRODUCTION**
Branch: `harden-release-verification`
Last updated: 2026-05-17

This file records the evidence required before `urai-privacy` can be called production-ready or used as the binding privacy control plane across the URAI ecosystem.

## Release candidate

- Repository: `LifeLoggerAI/urai-privacy`
- Branch: `harden-release-verification`
- Commit SHA: `TBD`
- Release version: `TBD`
- Firebase staging project: `TBD`
- Firebase production project: `TBD`
- Staging URL: `TBD`
- Production URL: `TBD`

## Required command evidence

Paste exact terminal output or CI artifact links below each gate.

### 1. Deterministic install

```txt
TBD: npm ci
TBD: npm ci --prefix functions
```

### 2. Static quality gates

```txt
TBD: npm run lint
TBD: npm run typecheck
TBD: npm run test:unit
TBD: npm run test:rules:static
TBD: npm run test:e2e
TBD: npm run audit:tier-one
```

### 3. Production build gates

```txt
TBD: npm run build
TBD: npm --prefix functions run build
TBD: npm --prefix functions run typecheck
```

### 4. Firebase emulator behavioral gates

Firebase emulators require Java. Install OpenJDK/Temurin 17+ before running the full verifier.

```txt
TBD: java -version
TBD: npm run test:emulators
```

### 5. Security gate

```txt
TBD: npm run security:gate
```

### 6. Production readiness assertions

```txt
TBD: bash scripts/assert-production-ready.sh
```

### 7. Full release verifier

```txt
TBD: bash scripts/verify-release.sh
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
| `LifeLoggerAI/UrAi` | TBD | TBD |
| `LifeLoggerAI/UrAiProd` | TBD | TBD |
| `LifeLoggerAI/urai-admin` | TBD | TBD |
| `LifeLoggerAI/urai-analytics` | TBD | TBD |
| `LifeLoggerAI/urai-communications` | TBD | TBD |
| `LifeLoggerAI/urai-studio` | TBD | TBD |
| `LifeLoggerAI/urai-spatial` | TBD | TBD |
| `LifeLoggerAI/urai-foundation` | TBD | TBD |
| `LifeLoggerAI/B2Bportal` | TBD | TBD |
| `LifeLoggerAI/asset-factory` | TBD | TBD |

## Production lock verdict

Current verdict: **BLOCKED**

Blocking items:

1. Full `bash scripts/verify-release.sh` output not recorded here.
2. Firebase emulator test evidence not recorded here.
3. Staging deployment evidence not recorded here.
4. Production deployment evidence not recorded here.
5. Legal/privacy governance approvals not recorded here.
6. Cross-repo adoption evidence not recorded here.

Do not change this verdict to **LOCKED** until all evidence sections are complete.
