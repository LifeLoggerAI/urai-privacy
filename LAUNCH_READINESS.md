# URAI Privacy Launch Readiness Checklist

Use this checklist before any public URAI launch, app release, website launch, beta, pilot, enterprise deployment, or data-sharing program.

## Governance Package

- [ ] `VERSION.md` reflects the active governance version.
- [ ] `CHANGELOG.md` includes the latest changes.
- [ ] `RELEASE_PROCESS.md` is followed.
- [ ] `MIGRATION_GUIDE.md` is available for product repos.
- [ ] `POLICY_VERSIONING.md` is current.
- [ ] `tools/validate_privacy_package.py` passes.
- [ ] GitHub branch protection is enabled for `main`.
- [ ] CODEOWNERS is configured.

## Website and Public Notices

- [ ] `uraiprivacy.com` DNS points to the selected host.
- [ ] `CNAME` contains `uraiprivacy.com`.
- [ ] `website/index.html` is published.
- [ ] Public privacy policy is reviewed by counsel.
- [ ] Biometric and AI inference notice is reviewed by counsel.
- [ ] Data-sharing / monetization notice is reviewed by counsel.
- [ ] Contact route for privacy requests is live.

## Product Repo Adoption

For each production repo:

- [ ] `privacy/PRIVACY_VERSION.md` exists.
- [ ] `privacy/data-inventory.yaml` exists.
- [ ] Feature manifests exist for data-processing features.
- [ ] L4 sensitive inference uses C4 consent.
- [ ] L5 biometric/identity signals use C5 consent and R6 retention.
- [ ] L6 anonymized data products use C8 consent.
- [ ] Data-sharing features require anonymization batch and cohort minimum.
- [ ] Deletion, export, revocation, explanation, and audit behavior are mapped.

## User Rights Implementation

- [ ] Consent state storage is implemented.
- [ ] Consent event logging is implemented.
- [ ] Data export request flow is implemented.
- [ ] Deletion request flow is implemented.
- [ ] Biometric-only deletion is implemented where relevant.
- [ ] User-visible privacy history is implemented.
- [ ] Sensitive insight explanation is implemented.
- [ ] Monetization/data-sharing opt-out is implemented where relevant.

## Security and Operations

- [ ] Admin access is least-privilege.
- [ ] Admin access is audit logged.
- [ ] Incident response owner is assigned.
- [ ] Vendor/processor review is complete.
- [ ] Law enforcement request intake process exists.
- [ ] Backup deletion/expiry behavior is documented.
- [ ] Crisis/safety sensitive data has stricter access controls.

## Launch Decision

- [ ] Approved for launch
- [ ] Approved with conditions
- [ ] Blocked

Reviewer:
Date:
Conditions:
