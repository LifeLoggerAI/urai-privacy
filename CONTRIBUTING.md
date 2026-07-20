# Contributing to URAI Privacy

URAI Privacy is the governance and enforcement authority for privacy decisions across the URAI ecosystem. Contributions must preserve user control, least privilege, explicit consent, data minimization, auditability, and fail-closed release behavior.

## Contribution Rules

1. Start from the current default branch and keep each change narrowly scoped.
2. Describe the privacy impact, affected data classes, consent tiers, retention classes, user-rights behavior, and rollback path.
3. Do not commit secrets, credentials, personal data, production exports, provider tokens, private keys, or real-user fixtures.
4. Do not weaken schemas, tests, security gates, required evidence, protected-route indexing controls, or release checks to make a change pass.
5. Use synthetic and non-identifying fixtures only. Any authenticated or destructive test requires a separately approved environment and identity.
6. Preserve export, deletion, correction, consent-revocation, retention, and audit contracts whenever a change touches user data.
7. Run the repository's permanent validation and release workflows. Green source evidence does not by itself authorize deployment, publication, provider delivery, or production-data mutation.
8. Use the exact Firebase CLI pinned in `devDependencies` and `package-lock.json` for emulator and deployment commands; do not rely on an untracked global binary.
9. Refresh dependency locks only through deterministic installs and non-breaking audit remediation. Critical production vulnerabilities must be zero; any remaining lower-severity transitive finding must stay visible and be assigned an explicit disposition rather than hidden by a weakened gate.

## Sensitive Change Areas

Changes in these areas require explicit privacy and security review:

- `policy/`, `schemas/`, `legal/`, `architecture/`, and `sops/`;
- Firestore or Storage rules, authentication, authorization, custom claims, admin access, break-glass access, and audit logging;
- consent, sensitive inference, biometrics, children or minors, data sharing, monetization, retention, deletion, export, correction, or anonymization;
- provider processing, external delivery, cross-repository data flow, production credentials, deployment workflows, DNS, monitoring, recovery, and rollback;
- public claims about privacy, security, legal compliance, medical outcomes, autonomous actions, scale, or certification.

Reviewers must reject silent scope expansion, default-allow behavior, unsupported claims, real-user test data, and any change that creates competing privacy authority.

## Legal Review

Legal Review is required before publishing or materially changing privacy policies, terms clauses, biometric or AI-inference notices, children and minor policies, data-sharing notices, law-enforcement request policy, regulatory claims, or public compliance statements.

Automated checks and repository-owner approval do not replace qualified legal review. Until the required human approval is recorded, affected publication and deployment gates remain fail-closed.

## Pull Request Evidence

A merge-ready pull request should identify:

- exact base and head SHAs;
- changed-file scope;
- terminal workflow runs and retained artifacts;
- privacy and security reviewers where required;
- what was not executed and why;
- protected-environment, provider, legal, publication, or production-data gates that remain external;
- recovery and rollback authority for any approved mutation.

Nothing ships if it violates this repository's privacy contracts.
