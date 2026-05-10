# URAI Privacy System Adoption Matrix

Status: live tracking document for URAI Privacy integration.

## Meaning of statuses

- Not started: no privacy adoption scaffold found or created.
- Draft scaffold: minimum adoption files exist, but real data mapping is incomplete.
- CI scaffolded: minimum adoption files exist and a privacy adoption workflow exists.
- Blocked: connector, permissions, legal, deployment, or implementation work is blocking completion.
- Complete: real data mapping, feature manifests, user-rights workflows, CI, review, and runtime verification are complete.

## Repository adoption state

| Repository | Adoption files | CI workflow | Current status | Notes |
|---|---:|---:|---|---|
| LifeLoggerAI/urai-privacy | Yes | Existing repo validation plus template workflow | Draft governance package | Source of truth for privacy rules, website, templates, and launch blockers. |
| LifeLoggerAI/UrAiProd | Yes | Yes | CI scaffolded | Requires real data inventory, feature manifests, runtime rights workflows, and review. |
| LifeLoggerAI/urai-spatial | Yes | Yes | CI scaffolded | Uses Markdown data inventory scaffold; structured YAML inventory still recommended. |
| LifeLoggerAI/urai-analytics | Yes | Yes | CI scaffolded | Requires real analytics data stores, processors, sharing rules, retention, export, deletion, and review. |
| LifeLoggerAI/urai-admin | No | No | Blocked | Initial scaffold write was blocked by connector. Needs least-privilege and audit mapping. |
| LifeLoggerAI/urai-jobs | No | No | Blocked | Initial scaffold write was blocked by connector. Needed for export, deletion, retries, and audit events. |
| LifeLoggerAI/urai-storytime | No | No | Not started | Needs privacy adoption scaffold and feature manifests. |
| LifeLoggerAI/urai-communications | No | No | Not started | Needs privacy adoption scaffold and feature manifests. |
| LifeLoggerAI/urai-studio | No | No | Not started | Needs privacy adoption scaffold and feature manifests. |
| LifeLoggerAI/urai-labs-llc | No | No | Not started | Needs privacy adoption scaffold and platform/infrastructure mapping. |

## Verification notes

The privacy adoption workflows were installed in UrAiProd, urai-spatial, and urai-analytics. GitHub commit status checks did not report results immediately after installation, so CI passing status is not yet verified from the status API.

## Completion requirements

URAI Privacy is not system-complete until every production repository is at Complete status and the public website, legal notices, request intake, consent storage, export, deletion, biometric deletion, admin operations, audit events, monitoring, and support workflows are all verified end to end.
