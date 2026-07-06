# URAI Privacy Canonical Product Adoption

Date: 2026-07-06

## Authority

- Canonical public product: `LifeLoggerAI/urai-spatial`
- Canonical public runtime: `urai-tier1`
- Privacy control plane: `LifeLoggerAI/urai-privacy`
- Legacy repositories such as `UrAi`, `UrAi-Dev`, and `UrAiProd` are not current public-product authority.

## Required integration

The privacy control plane is not production-integrated until the canonical spatial product proves:

1. `/privacy-controls` displays the dedicated privacy surface rather than Home content.
2. Passport exposes consent, provenance, export and deletion actions through versioned contracts.
3. Authenticated users can create and inspect their own consent/export/deletion records.
4. Other users cannot read or mutate those records.
5. Admin actions require reviewed role claims and produce append-only audit evidence.
6. Export packages are private, time-limited and owner-authorized.
7. Destructive deletion requires a current dry-run plan, legal-hold check and explicit confirmation.
8. Revocation propagates to affected spatial, analytics, communications, content and provider workflows.
9. Retention and deletion behavior matches public wording.
10. Exact tested, deployed and rollback SHAs are recorded for both repositories.

## Evidence boundary

Source files, mocked Firebase adapters, route screenshots, and HTTP 200 responses do not satisfy this adoption contract. Required proof includes exact-head CI artifacts, deployed rules/functions, authenticated positive and negative tests, live route fingerprints, monitoring and rollback evidence.

## Current status

`PARTIALLY IMPLEMENTED`

The privacy repository contains substantial backend, rules, tests and UI source. The canonical spatial adoption, current deployment and authenticated live proof remain blocked.
