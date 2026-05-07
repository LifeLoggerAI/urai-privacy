# Data Export Standard

URAI users must be able to export meaningful, readable, and machine-usable copies of their data.

## Export Scope

Exports must include, when applicable:

- Account profile data
- Consent history
- Stored memories and timeline records
- Transcripts and user-approved content
- Derived insights and explanation metadata
- Relationship/social graph data created by URAI
- Location-derived records
- Biometric enrollment status, not raw biometric templates unless explicitly requested and legally allowed
- Monetization ledger events
- Privacy request history

## Export Formats

URAI should support:

- JSON for portability
- CSV for tabular records
- Markdown or HTML for human-readable summaries
- ZIP bundles for multi-file exports

## Export Metadata

Every export must include:

- `exportId`
- `userId`
- `createdAt`
- `policyVersion`
- `schemaVersion`
- `dataClassesIncluded`
- `dateRange`
- `integrityManifest`

## Redaction Rules

Exports must not reveal another person's private data unless that data is already part of the requesting user's authorized record and disclosure is lawful and expected.

## Delivery Rules

- Exports require authenticated requests.
- Download links must expire.
- Export jobs must be audit logged.
- Failed exports must preserve an error reason.
- Sensitive exports may require step-up authentication.

## Portability Principle

A user should be able to leave URAI with a comprehensible record of what was stored, inferred, shared, monetized, and consented to.
