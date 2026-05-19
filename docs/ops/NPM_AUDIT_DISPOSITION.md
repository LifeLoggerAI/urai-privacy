# NPM Audit Disposition

Date: 2026-05-19
Owner: URAI Privacy / Release Owner
Status: release evidence placeholder until a clean `npm audit --omit=dev` or approved exception is attached.

## Purpose

This document records the disposition process for dependency advisories before production release.

## Current known state

Earlier operator verification reported 5 moderate root npm audit findings. Functions package audit reported 0 vulnerabilities in the supplied verification log.

The repo security gate currently enforces critical vulnerability blocking and prints full production audit visibility. Production release still requires one of the following:

1. Clean production audit, or
2. documented accepted risk for each remaining advisory, or
3. dependency upgrade plan with owner and date.

## Required commands

Run from repo root:

```bash
npm audit --omit=dev
npm audit --audit-level=critical --omit=dev
npm --prefix functions audit --omit=dev
npm --prefix functions audit --audit-level=critical --omit=dev
```

## Disposition table

| Package/advisory | Severity | Direct/transitive | Affected path | Runtime reachable? | Decision | Owner | Target date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | fix / accept / monitor | TBD | TBD | Fill after latest audit output. |

## Acceptance rules

- Critical vulnerabilities block release.
- High vulnerabilities block release unless legal/security explicitly accepts risk and runtime reachability is false or mitigated.
- Moderate vulnerabilities require documented disposition before production release.
- Dev-only vulnerabilities may be accepted for production if they do not affect build/deploy integrity and security owner signs off.
- Transitive vulnerabilities require either override, upstream upgrade, or accepted risk.

## Current release decision

Production cannot be marked complete until this file is updated with the latest audit output and disposition.