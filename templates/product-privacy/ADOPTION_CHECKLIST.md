# URAI Privacy Product Adoption Checklist

Copy this checklist into each URAI production repository under `privacy/adoption-report.md`.

## Required files

- [ ] `privacy/PRIVACY_VERSION.md` exists.
- [ ] `privacy/data-inventory.yaml` exists.
- [ ] `privacy/feature-manifests/` exists.
- [ ] Every data-processing feature has a feature manifest.

## Data mapping

- [ ] Every collected field has a data class.
- [ ] Every derived field has a data class.
- [ ] Every inferred field has a data class.
- [ ] Every shared field has a data class.
- [ ] Every vendor/processor is listed.

## Consent mapping

- [ ] Every collection purpose has a consent tier.
- [ ] Sensitive inference has explicit consent where required.
- [ ] Biometric or identity-linked processing has explicit consent where required.
- [ ] Data-sharing or monetization has explicit opt-in where required.
- [ ] Revocation behavior is implemented.

## User rights

- [ ] Export behavior is mapped.
- [ ] Deletion behavior is mapped.
- [ ] Biometric-only deletion is mapped where relevant.
- [ ] Correction behavior is mapped where relevant.
- [ ] Explanation behavior is mapped for sensitive insights.
- [ ] Opt-out behavior is mapped for optional sharing or monetization.

## Operations

- [ ] Admin access is least-privilege.
- [ ] Support access is least-privilege.
- [ ] Privacy-sensitive actions emit audit events.
- [ ] Incident response owner is assigned.
- [ ] Backup deletion or expiry behavior is documented.

## Release gate

- [ ] Product owner approval.
- [ ] Privacy reviewer approval.
- [ ] Legal approval where required.
- [ ] CI privacy validation passes.

## Launch decision

Status: draft | approved | approved_with_conditions | blocked

Reviewer:
Date:
Conditions:
