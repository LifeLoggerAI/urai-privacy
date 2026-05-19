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