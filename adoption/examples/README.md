# Product Repo Adoption Examples

These examples show how different URAI repo types should structure a `privacy/` adoption folder before launch.

Each example is intentionally small and safe. It is not production data. Product teams should copy the closest example, replace placeholders with repo-specific fields and feature manifests, then run the cross-repo validator.

## Examples

- `admin-repo/` — admin tooling with tightly controlled admin access and audit logging.
- `analytics-repo/` — anonymized analytics or data-product workflows requiring C8 consent and cohort controls.
- `product-app-repo/` — user-facing app features that collect behavioral context and produce sensitive user-facing inference.

## Required Validation

After copying an example into a downstream repo as `privacy/`, run:

```bash
python adoption/ci/validate_repo_privacy.py
```

The downstream repo should also install the privacy adoption GitHub Actions workflow from `adoption/ci/privacy-adoption-workflow.yml`.
