# URAI System-of-Systems Privacy Contract

Status: **control-plane contract mapped**

This contract defines how Tier-One URAI systems must integrate with `LifeLoggerAI/urai-privacy` before any production release can be called cohesive, privacy-ready, or system-of-systems integrated.

The executable registry is `privacy/system-of-systems/registry.json` and is enforced by:

```bash
npm run audit:privacy
bash scripts/verify-release.sh
```

## Control plane

`LifeLoggerAI/urai-privacy` is the canonical privacy control plane for:

- consent state and consent event evidence
- user export requests and export jobs
- deletion requests and deletion processing evidence
- retention policy explanation and exceptions
- audit logs, admin actions, and privacy evidence
- private export/evidence storage prefixes

Canonical Firestore collections:

- `privacyRequests`
- `exportJobs`
- `deletionRequests`
- `consentRecords`
- `consentEvents`
- `auditLogs`
- `adminActions`
- `privacyEvidence`

Canonical callable Functions:

- `createExportRequest`
- `processExportRequest`
- `createDeletionRequest`
- `processDeletionRequest`
- `updateConsent`
- `recordAdminAction`
- `getPrivacyHealthReport`

Canonical Storage prefixes:

- `exports/{uid}/`
- `evidence/{uid}/`

## Required adoption controls

Every Tier-One system must map and enforce these controls:

1. `consent` — optional processing, personalization, analytics, communications, reuse, sharing, training, and sensitive capture must be gated by the relevant consent state.
2. `export` — retained user-linked data must either be exportable or explicitly exempted with a documented legal/technical reason.
3. `deletion` — user-linked data must be deletable, anonymizable, or legally retained with evidence.
4. `retention` — data classes must have retention behavior and exceptions.
5. `audit` — privacy-relevant user/admin/system actions must be evidenced.
6. `adminAccess` — admin authority must be verified server-side with custom claims or verified role documents.
7. `dataMinimization` — optional or sensitive data must be avoided unless justified by product/legal need and consent basis.
8. `incidentResponse` — privacy-impacting incidents must be recorded with owner, timeline, and remediation evidence.

## Tier-One systems

The required Tier-One systems are:

- `LifeLoggerAI/UrAi`
- `LifeLoggerAI/UrAiProd`
- `LifeLoggerAI/urai-admin`
- `LifeLoggerAI/urai-analytics`
- `LifeLoggerAI/urai-communications`
- `LifeLoggerAI/urai-studio`
- `LifeLoggerAI/urai-spatial`
- `LifeLoggerAI/urai-foundation`
- `LifeLoggerAI/B2Bportal`
- `LifeLoggerAI/asset-factory`

Each system has a registry entry with:

- system id
- repository name
- tier
- role
- data domains
- integration status
- required adoption text for all eight controls
- release evidence references

## Status meanings

| Status | Meaning | Production implication |
|---|---|---|
| `control-plane-contract-mapped` | The central privacy repo defines the downstream contract and release evidence requirement. | Not enough for production by itself. |
| `live-adopted` | The downstream repo has implemented, tested, deployed, and recorded evidence for the contract. | Eligible for production evidence review. |
| `waived` | A dated owner-approved exception exists with mitigation and expiry/review conditions. | Acceptable only if recorded in `docs/LOCK.md`. |

## Release rule

A release cannot be called **live production system-of-systems integrated** until:

1. `npm run audit:privacy` passes.
2. `bash scripts/verify-release.sh` passes.
3. `docs/LOCK.md` records current commit, deploy evidence, and adoption evidence.
4. Every Tier-One repo is either `live-adopted` or has an explicit dated owner-approved exception.
5. Staging and production Firebase deploy evidence is recorded.
6. Legal/privacy governance approvals are recorded.

## Implementation guidance for downstream repos

Each downstream repo should add a local privacy adoption file, for example:

```txt
privacy/adoption/urai-privacy.json
```

Recommended minimum fields:

```json
{
  "controlPlaneRepo": "LifeLoggerAI/urai-privacy",
  "controlPlaneContract": "2026-05-17.system-of-systems.v1",
  "repo": "LifeLoggerAI/<repo>",
  "status": "live-adopted",
  "dataDomains": [],
  "controls": {
    "consent": { "implemented": true, "evidence": [] },
    "export": { "implemented": true, "evidence": [] },
    "deletion": { "implemented": true, "evidence": [] },
    "retention": { "implemented": true, "evidence": [] },
    "audit": { "implemented": true, "evidence": [] },
    "adminAccess": { "implemented": true, "evidence": [] },
    "dataMinimization": { "implemented": true, "evidence": [] },
    "incidentResponse": { "implemented": true, "evidence": [] }
  }
}
```

The central `docs/LOCK.md` should then be updated from `control-plane-contract-mapped` to `live-adopted` only after target-repo evidence exists.
