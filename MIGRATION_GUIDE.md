# URAI Privacy Migration Guide

This guide explains how URAI product repos migrate from one privacy governance version to another.

## Migration Checklist

For each repo adopting a new privacy governance version:

1. Read `CHANGELOG.md` for new or breaking privacy requirements.
2. Update `privacy/PRIVACY_VERSION.md`.
3. Re-run the repo data inventory against `policy/data-classes.yaml`.
4. Re-map feature manifests against `policy/consent-tiers.yaml` and `policy/retention-classes.yaml`.
5. Check whether any feature now requires C4, C5, C6, C8, or stronger review.
6. Re-run privacy review records for affected features.
7. Update user-facing consent copy if consent, retention, sharing, or sensitive inference behavior changed.
8. Confirm deletion/export/audit behavior still satisfies the new governance version.
9. Update launch readiness status.

## Breaking-Change Examples

A migration is breaking if it:

- adds a new sensitive data class
- changes required consent tier for an existing class
- changes retention requirements
- adds new export or deletion requirements
- changes anonymized data-sharing rules
- changes biometric handling or deletion requirements
- changes user notice or legal template obligations

## Migration Record Template

```yaml
repo: REPLACE_WITH_REPO
fromVersion: REPLACE_WITH_OLD_VERSION
toVersion: REPLACE_WITH_NEW_VERSION
migrationOwner: REPLACE_WITH_OWNER
migrationDate: YYYY-MM-DD
status: planned | in_progress | complete | blocked
changedRequirements:
  - REPLACE_WITH_REQUIREMENT
updatedFiles:
  - privacy/PRIVACY_VERSION.md
  - privacy/data-inventory.yaml
  - privacy/feature-manifests/example.privacy.yaml
reviewNotes: REPLACE_WITH_NOTES
```

## Rollback

If a product repo cannot adopt a new privacy version safely, it must not claim the new version. Instead, open a privacy gap issue and mark the feature or repo as blocked until the migration is complete.
