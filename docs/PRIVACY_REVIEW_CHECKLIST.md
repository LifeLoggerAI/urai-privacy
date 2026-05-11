# Privacy Review Checklist

Use this checklist before shipping any URAI feature, API, model, pipeline, admin page, analytics job, export flow, monetization product, or integration.

## Feature Identity

- [ ] Feature name is documented.
- [ ] Owning repo is documented.
- [ ] Owning person/team is documented.
- [ ] Release target is documented.
- [ ] Privacy governance version is declared.

## Data Classification

- [ ] Every collected field has a data class.
- [ ] Every derived field has a data class.
- [ ] Sensitive inferences are classified as L4 or higher.
- [ ] Biometric/identity signals are classified as L5.
- [ ] Monetized aggregate signals are classified as L6.
- [ ] No unclassified fields are stored or processed.

## Consent

- [ ] Required consent tiers are mapped.
- [ ] Consent prompt copy exists.
- [ ] Consent is granular and not bundled.
- [ ] Revocation path exists.
- [ ] Feature degrades gracefully when consent is denied or revoked.
- [ ] Consent events are logged with policy version.

## Data Minimization

- [ ] Raw sensitive data is avoided where possible.
- [ ] On-device processing is used where feasible.
- [ ] Raw audio/image/biometric storage is minimized.
- [ ] Only necessary fields are retained.

## Retention and Deletion

- [ ] Every field has a retention class.
- [ ] User deletion path exists.
- [ ] Derived data deletion/recompute logic exists.
- [ ] Backup expiry behavior is documented.
- [ ] Biometric deletion is independently available if relevant.

## Export and Explainability

- [ ] User export includes relevant records.
- [ ] Insight explanations include source categories.
- [ ] User can understand why a sensitive insight exists.
- [ ] Export and explanation flows are audit logged.

## Admin and Audit

- [ ] Admin access is role-gated.
- [ ] Admin access is audit logged.
- [ ] Automated processing is traceable.
- [ ] Incident hooks are present for misuse or failure.

## Monetization

- [ ] Monetization is opt-in only.
- [ ] Opt-out stops future inclusion.
- [ ] Cohort minimum is met.
- [ ] Re-identification risk is assessed.
- [ ] Revenue ledger event is recorded.
- [ ] Raw sensitive or biometric data is never sold.

## Release Decision

- [ ] Approved
- [ ] Approved with conditions
- [ ] Blocked

Reviewer:
Date:
Notes:
