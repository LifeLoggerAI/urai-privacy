# URAI Privacy Adoption Guide

This guide explains how each URAI repository adopts the `urai-privacy` governance package.

## Required Integration Steps

1. Declare the implemented privacy governance version.
2. Add a privacy manifest for every feature that collects, infers, stores, exports, shares, or monetizes data.
3. Map every stored and derived field to a data class.
4. Map every processing purpose to a consent tier.
5. Define retention, deletion, export, and audit behavior.
6. Run privacy review before release.
7. Block releases when required privacy fields are missing.

## Repos That Must Adopt This Package

- `UrAi`
- `UrAiProd`
- `UrAi-Dev`
- `urai-admin`
- `urai-analytics`
- `urai-communications`
- `urai-content`
- `urai-foundation`
- `urai-labs-llc`
- `urai-marketing`
- `urai-spatial`
- `urai-staging`
- `urai-studio`

## Required Files Per Product Repo

Each repo should add:

```text
privacy/
  PRIVACY_VERSION.md
  data-inventory.yaml
  feature-manifests/
    <feature-name>.privacy.yaml
```

## Release Rule

A URAI repo is not release-ready if:

- it has user data without a data class
- it has sensitive inference without C4 consent
- it has biometric identity without C5 consent
- it has data-sharing or monetization without C8 consent
- it lacks deletion behavior for user-controlled records
- it lacks export behavior for user-visible records
- admin or automated sensitive access is not audit logged

## Minimal Adoption Checklist

- [ ] `privacy/PRIVACY_VERSION.md` exists
- [ ] `privacy/data-inventory.yaml` exists
- [ ] feature manifests exist for all data-processing features
- [ ] consent tiers are mapped
- [ ] retention classes are mapped
- [ ] deletion behavior is mapped
- [ ] export behavior is mapped
- [ ] audit events are mapped
- [ ] privacy review checklist is complete
