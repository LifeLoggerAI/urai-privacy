# URAI Privacy Wave 1 Polish Status

Status: in_build
Domain: uraiprivacy.com
Repo: LifeLoggerAI/urai-privacy
System: URAI Privacy

## Purpose

This document tracks the Wave 1 polish pass for `uraiprivacy.com` as the public trust, consent, Passport, data-rights, and responsible AI center for the URAI network.

## Non-Negotiable Boundary

`uraiprivacy.com` is the privacy and trust center.

It should focus on:

- Passport
- consent categories
- data controls
- delete and export request paths
- responsible AI principles
- safety boundaries
- privacy contact and support paths

It should not become:

- UrAi app homepage
- URAI Studio sales page
- investor portal
- broad Labs ecosystem homepage
- private admin dashboard

## Existing Release Infrastructure Found

The Privacy repo includes launch-grade scripts in `package.json`, including:

- `preflight`
- `preflight:production`
- `security:gate`
- `verify:production`
- `verify:release`
- `release:evidence:staging`
- `audit:privacy`
- `audit:tier-one`
- `urai:qa`
- smoke, integration, rules, and live smoke tests

Wave 1 polish should use this existing pipeline instead of replacing it.

## Wave 1 Adoption Doc Added

File:

- `docs/URAI_WAVE1_SHARED_FOUNDATION_ADOPTION.md`

Commit:

- `a267bd3e061b02775eec25f8d4ae6b03b92801c6`

## Constants File Status

A code constants file was attempted from the orchestration workflow, but the write was blocked by platform safety checks because of dense trust/control wording.

For now, the adoption document remains the source of truth until constants are added manually or through a smaller repo-local patch.

## Required Privacy Routes

Confirm or implement:

- `/`
- `/passport`
- `/data-controls`
- `/consent-categories`
- `/what-urai-does-not-do`
- `/delete-export`
- `/responsible-ai`
- `/safety`
- `/contact`
- `/privacy`
- `/terms`

## Content Polish Requirements

Hero line:

> Privacy is not a setting. It is the system.

Primary CTA:

> Explore URAI Passport

Secondary CTA:

> Read Privacy Principles

Required areas:

- consent category overview
- Passport philosophy
- data controls
- delete/export request path
- responsible AI principles
- sensitive AI boundaries
- what URAI does not do
- contact privacy team form
- ecosystem trust links

## Form Requirements

Privacy requests should capture:

- name
- email
- request type
- message
- acknowledgement or consent flag
- source domain
- source path
- UTM/source attribution

Preferred form type:

- `privacy`

Preferred destination:

- `privacyRequests`

## QA / Evidence Required

Before `uraiprivacy.com` can be marked ready for Wave 1 review:

- run `npm run preflight`
- run `npm run preflight:production`
- run `npm run security:gate`
- run `npm run verify:release`
- verify production URL
- verify staging URL if used
- verify DNS and SSL
- verify privacy/delete/export request path
- verify no planned controls are represented as active controls unless implemented
- verify all public URAI sites can link to this privacy center
- verify mobile readability and accessibility baseline

## Current Blockers

- privacy route/content inspection still pending
- privacy request form wiring not yet verified in this Wave 1 pass
- constants file still pending because orchestration write was blocked
- live deployment evidence pending
- DNS/SSL evidence pending
- production/staging verification pending

## Next Step

Inspect current Privacy routes and align stale public copy with the Wave 1 adoption document while preserving the trust/consent boundary.
