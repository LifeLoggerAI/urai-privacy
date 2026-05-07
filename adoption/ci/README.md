# Cross-Repo Privacy CI Enforcement

This folder contains reusable CI templates and scripts that URAI repos can copy into their own repositories to validate privacy adoption files.

## Goal

Every URAI product repo should be able to validate its local `privacy/` folder against the active `urai-privacy` governance package.

## Expected Product Repo Layout

```text
privacy/
  PRIVACY_VERSION.md
  data-inventory.yaml
  feature-manifests/
    feature-name.privacy.yaml
```

## Files in This Folder

- `privacy-adoption-workflow.yml` - GitHub Actions workflow template for product repos
- `validate_repo_privacy.py` - standalone validator for product repo `privacy/` folders
- `sample-privacy-folder/` - minimal valid product repo privacy folder

## Copy Instructions

In each URAI product repo:

1. Copy `validate_repo_privacy.py` to `tools/validate_repo_privacy.py`.
2. Copy `privacy-adoption-workflow.yml` to `.github/workflows/privacy-adoption.yml`.
3. Create or update the repo's `privacy/` folder.
4. Run:

```bash
pip install PyYAML>=6.0.1
python tools/validate_repo_privacy.py
```

## What It Checks

- `privacy/PRIVACY_VERSION.md` exists and references `0.1.0-draft`
- `privacy/data-inventory.yaml` exists and uses known L0-L7, C0-C8, and R0-R6 values
- feature manifests exist under `privacy/feature-manifests/`
- L4 fields require C4 consent
- L5 fields require C5 consent and R6 retention
- L6/data-sharing features require C8, anonymization batch, and minimum cohort size >= 100
- L3-L5 features require deletion and consent revocation support
