# URAI Privacy Architecture

This folder contains lifecycle diagrams and operating flows for the URAI Privacy governance package.

## Lifecycles

- [Consent Lifecycle](./CONSENT_LIFECYCLE.md)
- [Deletion Lifecycle](./DELETION_LIFECYCLE.md)
- [Export Lifecycle](./EXPORT_LIFECYCLE.md)
- [Anonymization and Data-Sharing Lifecycle](./ANONYMIZATION_DATA_SHARING_LIFECYCLE.md)
- [Audit Lifecycle](./AUDIT_LIFECYCLE.md)
- [Incident Response Lifecycle](./INCIDENT_RESPONSE_LIFECYCLE.md)

## Purpose

These diagrams translate the governance package into operational flows that product, backend, admin, analytics, and privacy teams can implement consistently across URAI repos.

Every lifecycle should map back to:

- data classes in `policy/data-classes.yaml`
- consent tiers in `policy/consent-tiers.yaml`
- retention classes in `policy/retention-classes.yaml`
- audit event types in `policy/audit-event-types.yaml`
- blocked uses in `policy/blocked-data-uses.yaml`
