# Contributing to URAI Privacy

URAI Privacy is a governance and enforcement repository for privacy-sensitive product behavior. Contributions must preserve fail-closed authorization, consent, deletion, export, retention, audit, and recovery boundaries.

## Contribution Rules

1. Open an issue or pull request that states the privacy problem, affected data classes, consent tier, retention class, user-rights impact, rollback plan, and evidence required for acceptance.
2. Keep changes narrowly scoped. Do not combine policy, legal language, runtime behavior, deployment authority, and unrelated cleanup in one change unless the dependency is unavoidable and documented.
3. Never commit real user data, access tokens, credentials, service-account material, private keys, production identifiers, support tickets, legal requests, or incident evidence.
4. Use synthetic fixtures only. Fixtures must not resemble or reproduce identifiable production records.
5. Preserve least privilege, authenticated actor binding, exact resource ownership, idempotency, auditability, and fail-closed behavior.
6. Do not weaken a validator or convert a required failure into a warning merely to make CI pass.
7. Run the repository unit tests, website checks, secret scan, and privacy package validator before requesting review.
8. Include exact commands, exact commit SHA, retained artifacts, and recovery evidence for any release-affecting change.

## Sensitive Change Areas

Changes in the following areas require focused privacy and security review:

- authentication, authorization, owner/admin separation, and cross-user denial;
- consent collection, revocation, purpose limitation, and consent receipt generation;
- export, deletion, legal hold, residual-data verification, and downstream acknowledgement;
- biometric, health-adjacent, location, relationship, child/minor, or inferred sensitive data;
- retention, lease expiry, retry, idempotency, and recovery behavior;
- audit logging, monitoring, incident response, and break-glass access;
- vendor, processor, provider, analytics, advertising, or data-sharing integrations;
- Firestore, Storage, Auth, queue, worker, deployment, credential, and environment boundaries;
- public privacy notices, terms, policy templates, and launch claims.

For destructive operations, reviewers must verify authenticated ownership, exact plan/lease binding, UID and actor drift rejection, legal-hold behavior, residual scans, mandatory fresh-plan recovery, rollback-safe retry, and cross-user denial.

## Legal Review

Legal templates and policy text in this repository are implementation aids, not a substitute for qualified counsel. External legal review is required before public reliance on changes involving:

- privacy policies, terms, biometric or AI inference notices;
- children or minors;
- data sharing, monetization, advertising, or processor commitments;
- law-enforcement requests, regulatory representations, or jurisdiction-specific rights;
- corporate, intellectual-property, nonprofit, public-benefit, medical, accessibility, or compliance claims.

A pull request requiring legal review must identify the review trigger, the approver, the reviewed version, and any launch restriction. Missing approval remains a release blocker.

## Pull Request Evidence

A complete pull request should include:

- the exact head SHA and affected files;
- threat and privacy impact summary;
- tests and validators executed;
- retained diagnostic artifacts for failures and destructive-operation proofs;
- deployment, monitoring, rollback, and recovery plan when applicable;
- confirmation that no production data, provider call, billing action, credential mutation, or live destructive operation occurred unless separately authorized and evidenced.

Reviewers should reject stale-head, synthetic-merge, queued, cancelled, skipped, artifact-free, or uninspected evidence.

## Reporting Security or Privacy Issues

Do not disclose vulnerabilities, credentials, personal data, or active incidents in public issues. Follow `SECURITY.md` for private reporting and `SUPPORT.md` for support boundaries.
