# URAI Privacy Policy Versioning

URAI Privacy uses semantic governance versioning so product repos can safely adopt, migrate, and audit privacy requirements.

## Version Format

```text
MAJOR.MINOR.PATCH[-status]
```

Examples:

- `0.1.0-draft`
- `0.2.0-draft`
- `1.0.0`

## Major Versions

Use a major version when a change can materially affect user rights, legal review, product release gates, or existing consent expectations.

Examples:

- New required consent model
- New data class
- New biometric processing requirement
- New data-sharing or monetization restriction
- Breaking schema/API contract change
- More restrictive deletion/export requirements

## Minor Versions

Use a minor version for new non-breaking governance capabilities.

Examples:

- New template
- New registry field
- New validator check that does not invalidate compliant repos
- New example or fixture
- New operational policy

## Patch Versions

Use a patch version for clarifications and non-material fixes.

Examples:

- Typo fixes
- Wording improvements
- Link updates
- Non-breaking documentation cleanup

## Version Adoption

Every product repo must declare the adopted version in:

```text
privacy/PRIVACY_VERSION.md
```

A product repo must not claim a version unless it satisfies the release gate and adoption checklist for that version.

## Version Drift

If a product repo is behind the active privacy version, the repo should create a migration issue and identify whether the drift blocks release.

## Legal Review Marker

Any governance version that changes public legal promises, sensitive inference, biometric handling, data-sharing, or user rights should be marked as requiring legal review before production launch.
