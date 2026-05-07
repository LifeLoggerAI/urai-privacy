# Vendor and Processor Review Standard

URAI vendors, subprocessors, APIs, AI providers, infrastructure providers, analytics tools, and data partners must be reviewed before processing URAI user data.

## Required Review Before Use

A vendor or processor may be used only when:

1. The business purpose is documented.
2. Data classes shared or processed are documented.
3. Consent requirements are mapped.
4. Retention and deletion behavior is understood.
5. Security controls are reviewed.
6. Data-sharing or resale restrictions are documented.
7. A contract, DPA, or equivalent terms are in place where required.
8. The vendor can support user rights requests when applicable.

## Vendor Risk Levels

| Level | Description | Examples |
|---|---|---|
| V0 | No user data | static hosting, public docs tooling |
| V1 | Low-risk operational data | uptime monitoring, basic crash telemetry |
| V2 | Personal data processor | email, auth, support tools |
| V3 | Sensitive data processor | transcripts, location, behavioral analytics, AI inference |
| V4 | Restricted processor | biometrics, crisis/safety signals, monetized data products |

## Required Vendor Record Fields

- vendor name
- service name
- owner
- purpose
- data classes
- consent tiers
- retention period
- deletion support
- export support
- subprocessors
- storage regions
- security review status
- contract/DPA status
- approval status
- review renewal date

## Prohibited Vendor Uses

URAI must not send sensitive inference, biometric, raw transcript, raw audio, or user-linked monetization records to a vendor without explicit approval and mapped consent.

## Renewal

V3 and V4 vendors require periodic review at least annually or whenever the processing purpose changes.
