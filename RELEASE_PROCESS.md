# URAI Privacy Release Process

This document defines how URAI Privacy governance versions are reviewed, released, and adopted across URAI repositories.

## Release Types

- **Major release**: Breaking change to consent, data classification, user rights, sensitive inference, biometrics, retention, or data-sharing rules.
- **Minor release**: New governance module, registry field, policy class, adoption template, or enforcement check.
- **Patch release**: Clarification, typo fix, non-breaking copy change, or documentation improvement.

## Release Requirements

Before tagging a release:

1. `VERSION.md` is updated.
2. `CHANGELOG.md` has a dated entry.
3. `tools/validate_privacy_package.py` passes.
4. Policy registries are internally consistent.
5. Legal templates impacted by the release are marked for counsel review.
6. Migration impact on product repos is documented.
7. Public website copy is still accurate.

## Release Steps

1. Create a branch named `release/privacy-vX.Y.Z`.
2. Update `VERSION.md` and `CHANGELOG.md`.
3. Run validation locally:

```bash
pip install -r requirements.txt
python tools/validate_privacy_package.py
```

4. Open a PR using the privacy governance PR template.
5. Merge after review and passing CI.
6. Create a Git tag:

```bash
git tag privacy-vX.Y.Z
git push origin privacy-vX.Y.Z
```

7. Notify product repo owners to update their `privacy/PRIVACY_VERSION.md` files.

## Adoption Rule

Product repos should not claim adoption of a privacy governance version until they have:

- version declaration
- data inventory
- feature privacy manifests
- deletion/export/audit mapping
- privacy review records
- CI or manual validation against this package
