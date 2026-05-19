# URAI V1 Privacy Release Gate

Date: 2026-05-19
Owner: URAI Privacy
Status: required launch gate for public V1/demo releases.

## Purpose

This gate prevents V1 from being marked public-launch-ready unless private/public boundaries, consent, export, deletion, retention, and audit behavior are explicit and verified.

## V1 data classification

| Data class | Examples | Public allowed | Admin allowed | Privacy control required |
| --- | --- | --- | --- | --- |
| Public demo profile | user-approved name/avatar/demo text/public showcase data | Yes, only user-approved fields | Yes | Correction/update path, removal path |
| Waitlist/contact | email, name, company, source/UTM, opt-in status | No | Limited admin/marketing roles | Consent, export, deletion, retention |
| Companion/chat | prompts, responses, memories, relationship context | No by default | Only audited support/admin paths | Explicit consent, redaction, export, deletion, retention |
| Passive/emotional signals | mood, attention, behavioral inference, activity context | No | Only after safety/legal approval and audit | High-friction consent, minimization, retention, export, deletion |
| Telemetry/analytics | route events, feature usage, errors, aggregate health | Aggregate only | Raw access only where necessary | Consent where required, redaction, aggregation, retention |
| Generated assets/manifests | user-generated outputs, asset metadata, provider metadata | Only approved/published assets | Studio/admin operators | Ownership, export, deletion, rights/retention |
| Admin/audit evidence | admin actions, data access events, deletion/export evidence | No | Admin/security/legal roles | Append-only retention, legal hold, no silent delete |

## Hard launch blockers

V1 cannot be marked launch-ready if any item below is missing:

1. Public/private data boundary is documented for every surfaced feature.
2. Waitlist writes are server-side or write-only; client reads of private waitlist data are denied.
3. Companion/chat and passive data are off or consent-gated.
4. No private passive, memory, relationship, or emotional signal is publicly readable.
5. Consent center is visible before any passive/emotional capture.
6. Export request flow is available or explicitly linked to `urai-privacy`.
7. Deletion request flow is available or explicitly linked to `urai-privacy`.
8. Retention classes are assigned for waitlist, telemetry, companion/chat, generated assets, and audit evidence.
9. Admin access requires custom claim or role document.
10. Admin inspection of user data writes audit evidence.
11. Cross-user reads are denied by rules or backend authorization.
12. Staging smoke and release verification evidence are attached.
13. Legal/privacy/security/support signoff exists.
14. Rollback SHA/path exists.
15. Live monitoring/incident route exists.

## Feature gate requirements

### Waitlist

- Collect only minimum fields needed for contact and launch communication.
- Store consent source, timestamp, and policy version.
- Do not expose waitlist data through public routes.
- Export/delete requests must include waitlist records.
- Retention default: delete or anonymize stale non-customer waitlist records after the approved retention window.

### Public demo/profile

- Only display fields intentionally approved for public display.
- Never infer public visibility from existence in Firestore.
- Add correction/removal path before launch.
- Audit admin changes to public status.

### Companion/chat/memory

- Off by default unless consent and retention are approved.
- No broad admin browsing.
- Support access must be case-bound and audited.
- Export must include stored user-visible chat/memory data.
- Deletion must remove user-scoped chat/memory data unless retained by legal hold.

### Passive/emotional signals

- Highest-risk class for V1.
- Must not launch silently.
- Requires explicit consent, visible trust setting, retention class, and redaction rules.
- Raw passive data must not be public, used in B2B demos, or inspected without audit.

### Telemetry/analytics

- Prefer aggregate and privacy-safe events.
- Raw user-scoped telemetry requires retention and export/delete handling.
- Dashboards must avoid exposing identifiers where aggregate data is enough.

### Generated assets/manifests

- Track owner, rights, provider, generated timestamp, and publication status.
- Public display requires approval/publish state.
- Export must include user-owned assets and manifests.
- Deletion must remove user-scoped unpublished assets unless legally retained.

## Launch approval checklist

- [ ] V1 public/private boundary reviewed.
- [ ] Waitlist handling reviewed.
- [ ] Companion/chat handling reviewed.
- [ ] Passive/emotional capture disabled or consent-gated.
- [ ] Telemetry/analytics retention approved.
- [ ] Generated asset ownership/rights approved.
- [ ] Export path verified.
- [ ] Deletion path verified.
- [ ] Consent path verified.
- [ ] Admin custom-claim/role access verified.
- [ ] Audit logging verified.
- [ ] Firestore/Storage rules verified.
- [ ] Live staging smoke completed.
- [ ] Legal/privacy/security/support signoff completed.
- [ ] Monitoring and rollback completed.

## Release decision

A release owner may mark V1 privacy-ready only when all required checklist items have evidence. Unknowns are blockers, not assumptions.