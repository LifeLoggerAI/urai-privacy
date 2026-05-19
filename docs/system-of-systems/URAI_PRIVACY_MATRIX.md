# URAI System-of-Systems Privacy Matrix

Date: 2026-05-19
Owner: URAI Privacy
Status: repo-level integration map; live production signoff still requires Firebase staging evidence, legal approval, and release signoff.

## Purpose

This matrix maps privacy expectations across the URAI system-of-systems so product repos can integrate with the standalone `urai-privacy` control plane without guessing data boundaries.

The matrix follows the repo evidence pattern used across URAI launch docs: code, docs, tests, smoke evidence, monitoring links, rollback SHA, and approval must agree before any subsystem is marked complete or locked.

## Evidence spine

- `LifeLoggerAI/urai-privacy`: implemented privacy control plane for consent, export, deletion, retention, audit, admin operations, legal hold, signed export retrieval, destructive deletion executor, release verification, and live smoke readiness.
- `LifeLoggerAI/UrAi`: canonical main-experience source; V1 backlog requires staging route verification, server-only waitlist writes, Firestore contract checks, consent center before passive capture, export/delete flows, and admin audit logging before inspecting user data.
- `LifeLoggerAI/UrAi-Dev`: staging audit says staging remains demo-level and production truth belongs in `LifeLoggerAI/UrAi`; it identifies high-risk passive capture, privacy-preserving features, mocked AI enrichment, consent verification, role claims, and safety/legal review as incomplete.
- `LifeLoggerAI/B2Bportal`: launch audit says B2B should not collect raw transcripts, consumer health data, biometrics, passive telemetry, payment cards, SSNs, home addresses, or private life logs; production blockers include Firebase env, admin seeding, final legal copy, monitoring, and domain deployment.
- `LifeLoggerAI/asset-factory`: completion checklist requires evidence-first release closure: local verification, staging smoke, production smoke, monitoring links, legal/privacy/security/support signoff, rollback SHA, deploy command, and owner approval before completion lock.

## Canonical privacy control-plane services

| Service | Implemented in `urai-privacy` | Required consumers |
| --- | --- | --- |
| Consent ledger | `consentRecords`, `consentEvents`, `updateConsent` callable | All repos that collect or process user/context data |
| Export request | `privacyRequests`, `exportJobs`, `processExportRequest`, signed URL retrieval | Main app, B2B/admin, analytics, asset/media systems |
| Deletion request | `deletionRequests`, dry-run/execute deletion executor | Main app, analytics, admin, jobs, studio, spatial, content |
| Legal hold | `legalHoldRecords`, `users/{uid}.legalHold`, rules/tests | All repos before destructive deletion |
| Audit evidence | `auditLogs`, `adminActions`, append-only rules | Admin, analytics, jobs, export/deletion processors |
| Retention policy | `retentionPolicies`, production readiness docs | All repos storing user/admin/system data |
| Live smoke/release evidence | `verify:release`, `test:smoke:live`, `RELEASE_SIGNOFF.md` | Release owners and deployment operators |

## Cross-repo privacy matrix

| Repo/system | Data collected/stored | Public display | Admin/operator display | Third parties | Retention/deletion/export requirement | Access controls | Audit/redaction requirement | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `UrAi` main experience | Waitlist/demo profile, companion context, future passive/memory/emotional signals | Public V1 routes and demo profile only | Admin audit before any user data inspection | Future AI/model providers only after safety/legal review | Must use `urai-privacy` consent/export/deletion before passive capture | Server-only private writes, ownerUid migration, deny client reads for private collections | Admin inspection must audit; passive signals require redaction/retention | Needs live staging proof and consent center before passive capture |
| `UrAi-Dev` staging | Staging contracts, demo Life Map data, mocked emotional/intelligence layers | Staging/demo surfaces only | Staging admin surfaces | None unless explicitly configured | Must not be mistaken for production truth | Staging access only; production port checklist required | Mark mocked/demo data clearly | Demo/staging, not production-final |
| `B2Bportal` | Business contact, company, role, use case, consent, partner metadata, audit, aggregate readiness | Partner/enterprise public copy | Lead/admin queues and partner dashboards | CRM/email/analytics after approval | Must link final privacy/DPA/retention and use privacy control plane for privacy requests | Firebase Auth, adminUsers, partner membership, deny-by-default rules | Audit lead/admin transitions; never collect consumer health/biometric/passive telemetry | Foundation wired; live env/legal/monitoring still pending |
| `asset-factory` | Asset requests, provider metadata, manifests, tenant/user asset records, billing/entitlement events | Public website/read-only manifest only | Studio/operator queues, provider health, queue/DLQ, billing health | Asset/model providers, Stripe, storage/CDN | Must support export/deletion for user-owned assets and metadata; completion lock requires evidence | API key/JWT/tenant isolation, cron secret, signed webhooks | Redact diagnostics; prove tenant isolation and provider/billing audit | Evidence-first release process defined; completion locked only after P0 proof |
| `urai-admin` | Operator actions, role assignments, release status, support decisions | None beyond public status/trust pages | Full admin cockpit | Monitoring/support systems | Admin data retained for legal/security evidence; deletion excludes audit/legal holds | Custom claims/role docs; least privilege | Every admin read/write requires audit | Must integrate with `auditLogs` and custom claims |
| `urai-analytics` | Aggregate events, readiness metrics, privacy-safe summaries | Aggregate dashboards only | Operational analytics | Analytics processors | Raw/user-scoped analytics must observe consent, retention, export, deletion | Owner/admin scoping for raw; aggregate-only public/business views | Redact raw identifiers in dashboards; audit admin data access | Needs live aggregate jobs and privacy-safe pipeline proof |
| `urai-jobs` | Background job metadata, status, errors, worker leases | None | Operator job/queue health | Provider APIs depending on job | Delete/export job metadata tied to user data; retain operational failure/audit evidence | Worker/service authority only; no broad client reads | Audit retries, failures, DLQ, destructive jobs | Needs queue/worker evidence and DLQ monitoring |
| `asset-factory` / media pipeline | Generated assets, rights metadata, provider outputs, manifests | Approved/public assets only | Provider diagnostics and approval queues | Media/model providers, CDN/storage | Asset rights and manifests must be exportable/deletable subject to legal hold | Tenant isolation, signed URLs, provider secret isolation | Rights ledger and provider diagnostics redaction | Must prove tenant/provider isolation before launch |
| `urai-content` | Prompts, copy, content registry, moderation metadata | Approved public content | Editorial/admin review | AI/content providers if enabled | User-derived content must obey consent/export/deletion | Role-gated editorial writes | Audit approvals/rejections and redactions | Requires moderation/legal checks for user-derived content |
| `urai-studio` | Studio assets, previews, exports, campaign artifacts | Approved exports/previews only | Studio/admin approval queues | Render/media providers | User/studio asset metadata must be exportable/deletable; rendered public assets require rights ledger | Auth/role/tenant gating | Audit asset approval/export | Needs rendering service and rights proof |
| `urai-spatial` | Spatial consent zones, scene graph indexes, room semantics, environmental signals | Only user-approved public scenes | Spatial/admin diagnostics | XR/device providers if enabled | Spatial/environmental data requires high-friction consent, minimization, retention, deletion | Owner-scoped, room/zone consent, no silent public sharing | Audit spatial consent and redaction | High-risk; do not enable without device/legal/safety QA |
| `urai-communications` | Email/call/transcript intelligence, support/privacy requests | Public support/trust copy only | Support/admin queues | Email/SMS/call providers | Transcripts/support records require retention, export, deletion, legal hold | Role-scoped support access | Audit every support/admin access; redact sensitive text | Needs provider/privacy review before live transcripts |
| `urai-marketing` | Campaign leads, UTM/source, waitlist entries, public forms | Public campaign pages | Marketing/admin dashboards | Analytics/CRM/email providers | Consent/unsubscribe/export/delete for marketing contacts | Form write-only, admin read-only | Audit consent source and campaign attribution | Needs final brand/legal/analytics consent proof |
| `urai-staging` | Test fixtures, staging data | Staging only | Staging operators | Test providers only | Must not mix real production user data unless explicitly approved | Separate Firebase/project isolation | Mark fixtures and scrub before sharing | Keep segregated from production |
| `UrAiProd` | Production deployment/runbook data, release snapshots, live config metadata | Public status/trust pages only | Release owner/operator data | Firebase/GCP/monitoring/legal tools | Must keep release evidence, rollback, monitoring, and privacy signoffs | Deployment owner authority, branch protection | Audit deployment, rollback, env changes | Requires live environment proof |

## Enforcement rules for all URAI repos

1. No repo may claim production privacy readiness without committed release evidence or a linked live verification record.
2. No passive capture may ship before consent center, retention schedule, export, deletion, and audit are wired.
3. No admin dashboard may inspect user data without custom-claim or role-doc enforcement and audit logging.
4. No destructive deletion may run without dry-run, current plan hash, legal-hold check, retained evidence, and audit event.
5. No export package may be publicly readable; use owner/admin-scoped signed retrieval.
6. No raw consumer health, biometric, passive telemetry, transcript, private memory, or relationship data may appear in B2B/public routes.
7. Every subsystem must define retention, deletion, export, redaction, admin access, and third-party provider boundaries.
8. Completion lock requires local verification, staging smoke, production smoke, monitoring links, rollback SHA, legal/privacy/security/support signoff, and owner approval.

## Integration actions now closed in `urai-privacy`

- Consent/update callable and records.
- Export request and signed download retrieval.
- Deletion request, dry-run, execute, legal hold, retained evidence, and audit trail.
- Firestore/Storage rules for owner/admin boundaries and retained evidence.
- Admin UI for request processing and destructive deletion execution.
- Live route smoke script and release signoff ledger.

## Remaining live gates

- Firebase staging/prod credentials and deployment proof.
- Admin custom-claim proof in live Firebase.
- Live smoke evidence for export, signed download, deletion dry-run, deletion execute, legal hold block, consent update, admin denied, and admin allowed.
- Legal/counsel approval of privacy policy, DPA, retention, subprocessors, support/privacy contacts, legal-hold behavior, and deletion scope.
- Monitoring/error routing and rollback proof.
- Npm audit disposition.
