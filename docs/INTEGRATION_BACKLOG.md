# URAI Privacy Integration Backlog

Status: **open**

This backlog tracks the cross-repo work required for `urai-privacy` to become the binding control plane for the URAI ecosystem.

## Priority legend

- P0: blocks production privacy readiness
- P1: required before public launch
- P2: required before scale/B2B expansion
- P3: improvement or automation

## P0: Control-plane adoption

| Item | Repo/system | Requirement | Evidence |
|---|---|---|---|
| Canonical data map | all Tier-One repos | Every collected/derived field maps to data class, consent tier, retention, export, deletion, audit behavior | TBD |
| Consent gate | URAI core | Tier 2/Tier 3 processing checks consent before passive or sensitive inference | TBD |
| Admin gate | `urai-admin` | Admin routes/actions use privacy least-privilege and audit standards | TBD |
| Analytics gate | `urai-analytics` | Analytics use consent, aggregation, and anonymization requirements | TBD |
| Communications gate | `urai-communications` | SMS/email/push flows respect consent and opt-out | TBD |
| Export/delete gate | all user-data systems | User data must be reachable by export/delete planner or explicitly exempted | TBD |
| Audit gate | all sensitive systems | Admin, sensitive inference, export, deletion, retention, and policy actions audited | TBD |

## P1: Product integration

| Item | Repo/system | Requirement | Evidence |
|---|---|---|---|
| Privacy Center entry point | URAI app | App links to hosted/privacy-center experience | TBD |
| Consent receipt display | URAI app | Users can see current consent state and receipts | TBD |
| Export status display | URAI app | Users can see export request status | TBD |
| Deletion status display | URAI app | Users can see deletion request status | TBD |
| Retention explainer | URAI app | Users can understand retention classes and exceptions | TBD |
| User audit ledger | URAI app | Users can see permitted privacy ledger entries | TBD |

## P1: Admin and operations

| Item | Repo/system | Requirement | Evidence |
|---|---|---|---|
| Request operations queue | `urai-admin` | Admins can process export/deletion requests | TBD |
| Audit review | `urai-admin` | Admins can inspect operational privacy logs | TBD |
| Policy versions | `urai-admin` / `urai-privacy` | Published policies are versioned and auditable | TBD |
| Incident handoff | `urai-labs-llc` | Privacy incident response owner and workflow documented | TBD |
| Legal hold | `urai-privacy` | Deletion flow respects legal hold when applicable | TBD |

## P2: Studio, Spatial, Foundation, and B2B

| Item | Repo/system | Requirement | Evidence |
|---|---|---|---|
| Media/story assets | `urai-studio` | Generated media, story exports, and user assets mapped to export/delete/retention | TBD |
| AR/VR/spatial data | `urai-spatial` | Spatial session data and biometric-adjacent signals mapped to consent and retention | TBD |
| Research/public-good data | `urai-foundation` | Research use requires clear consent, anonymization, and governance review | TBD |
| Tenant/business data | `B2Bportal` | B2B tenant data has purpose limitation and admin audit trails | TBD |
| Generated assets | `asset-factory` | Asset generation inputs/outputs mapped to user ownership and deletion rules | TBD |

## P2: Data monetization and sharing

| Item | Repo/system | Requirement | Evidence |
|---|---|---|---|
| Monetization opt-in | URAI app | Data sharing/monetization requires separate explicit opt-in | TBD |
| Aggregation threshold | `urai-analytics` | Shared analytics meet minimum aggregation/anonymization thresholds | TBD |
| Revocation | all systems | Opt-out stops future sharing and is auditable | TBD |
| Buyer access logs | marketplace/data systems | Any data access by buyer/partner is logged and governed | TBD |

## P3: Automation

| Item | Repo/system | Requirement | Evidence |
|---|---|---|---|
| Schema drift check | `urai-privacy` | CI detects mismatch between docs, schema, rules, Functions, and UI | TBD |
| Cross-repo scanner | org-level | CI scans Tier-One repos for unmapped collections/signals | TBD |
| Policy diff generator | `urai-privacy` | Policy version changes generate review checklist | TBD |
| Release badge | org-level | Repos expose privacy adoption status | TBD |

## Definition of done

An integration item is done only when:

1. Code or docs are merged in the target repo.
2. Tests or manual verification evidence are recorded.
3. `docs/LOCK.md` is updated when the item is production-blocking.
4. Any legal/privacy reviewer requirement is complete or explicitly waived by the owner.
