# Anonymization and Aggregation Standard

URAI anonymization must reduce re-identification risk before any data is shared, licensed, sold, researched, or analyzed outside the user's direct product experience.

## Required Controls

An anonymized data product must satisfy all of the following:

1. Direct identifiers removed.
2. Stable user IDs replaced with product-specific random IDs or removed.
3. Rare event combinations generalized or suppressed.
4. Cohort size meets the active minimum.
5. Sensitive categories are aggregated or excluded unless explicitly approved.
6. Re-identification risk is assessed before release.
7. The monetization ledger records the data product, purpose, buyer category, and revenue attribution.

## Minimum Cohort Size

Default minimum cohort size: **100 users**.

Higher minimums are required for:

- Location patterns
- Mental health or crisis patterns
- Biometric-derived patterns
- Relationship or social graph patterns
- Minors or protected populations

## Prohibited Data Products

URAI must not create data products that expose:

- Raw audio, raw transcripts, raw images, or raw biometric templates
- User-identifiable mental health, relationship, trauma, crisis, or deception inferences
- Individual movement trails
- Small-cohort sensitive patterns
- Data that enables targeting vulnerable users outside URAI's consented purpose

## Pseudonymization Is Not Anonymization

Replacing a name or email with a user ID is not enough. Pseudonymized records remain personal data and must be governed as such.

## Monetization Revocation

When a user opts out of monetization:

- Future inclusion stops immediately.
- Pending unreleased batches must exclude the user.
- Already released aggregate products are not reversed if they cannot identify the user, but the revenue ledger must reflect the opt-out date.

## Release Approval

Every anonymized data product requires a record with:

- data product name
- fields included
- transformations applied
- cohort size
- risk assessment
- approval owner
- policy version
- release date
