---
name: Privacy adoption rollout
description: Track adoption of URAI Privacy in another URAI repo
title: "Adoption rollout: "
labels: [privacy, adoption]
---

## Target Repo

Repo:
Owner:
Target date:

## Required Files

- [ ] `privacy/PRIVACY_VERSION.md`
- [ ] `privacy/data-inventory.yaml`
- [ ] `privacy/feature-manifests/*.privacy.yaml`
- [ ] `tools/validate_repo_privacy.py`
- [ ] `.github/workflows/privacy-adoption.yml`

## Required Validation

- [ ] L4 fields use C4
- [ ] L5 fields use C5 and R6
- [ ] L6/data-sharing uses C8
- [ ] L3-L5 features support deletion
- [ ] L3-L5 features support consent revocation
- [ ] data-sharing uses anonymization batch and cohort minimum

## Blockers

List blockers, missing manifests, or unresolved privacy questions.
