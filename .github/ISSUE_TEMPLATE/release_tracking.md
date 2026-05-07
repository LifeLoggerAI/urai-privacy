---
name: Privacy release tracking
description: Track a URAI Privacy governance version release
title: "Privacy release: "
labels: [privacy, release]
---

## Release

Version:
Release owner:
Target date:

## Release Type

- [ ] Major
- [ ] Minor
- [ ] Patch
- [ ] Draft update

## Required Updates

- [ ] `VERSION.md`
- [ ] `CHANGELOG.md`
- [ ] `RELEASE_PROCESS.md` followed
- [ ] `MIGRATION_GUIDE.md` impact reviewed
- [ ] `POLICY_VERSIONING.md` still accurate
- [ ] Product repo migration impact documented
- [ ] Legal review required if public notices or user rights changed

## Validation

- [ ] `pip install -r requirements.txt`
- [ ] `python tools/validate_privacy_package.py`
- [ ] CI passes

## Product Repo Adoption

List repos that must migrate or confirm no migration required.
