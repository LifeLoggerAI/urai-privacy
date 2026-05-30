# URAI Wave 1 Shared Foundation Adoption - URAI Privacy

Status: in_build
Domain: uraiprivacy.com
Repository: LifeLoggerAI/urai-privacy
System: URAI Privacy
Access class: Public

## Purpose

This document locks how the shared URAI network foundation should be applied to the URAI Privacy repository.

URAI Privacy is the public trust, consent, Passport, safety, and data-rights center for the URAI ecosystem.

## Separation Rule

`uraiprivacy.com` is the privacy and trust center.

It should not become the app homepage, studio sales page, investor room, or broad Labs homepage.

## Shared Foundation Files to Adopt

Copy or port from `LifeLoggerAI/urai-labs-llc`:

- `src/styles/urai-network-system.css`
- `src/lib/urai-attribution.js`
- `src/lib/urai-metadata.js`
- `src/lib/urai-form.js`
- `src/lib/urai-trust.js`
- `src/lib/urai-components.js`
- `scripts/urai-qa-checks.js`
- `scripts/README_URAI_QA_CHECKS.md`

Portal files may be used later for authenticated user privacy controls:

- `src/lib/urai-portal-components.js`
- `src/styles/urai-portal-system.css`

## Required Public Routes

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

## Homepage Requirements

Hero language:

> Privacy is not a setting. It is the system.

Primary CTA:

> Explore URAI Passport

Secondary CTA:

> Read Privacy Principles

Required sections:

- consent category overview
- Passport philosophy
- data controls
- delete/export request path
- responsible AI principles
- sensitive AI boundaries
- what URAI does not do
- contact privacy team form
- ecosystem trust links

## Claims Boundary

Do not imply that all Passport controls, deletion automation, export automation, or cross-domain preference syncing are fully active unless verified in production.

Use launch-safe wording:

- `designed around`
- `planned control layer`
- `available where active`
- `request access or support`
- `public trust center`

Avoid unsupported wording:

- `fully automated deletion everywhere`
- `complete data marketplace controls live`
- `medical-grade mental health protection`
- `all data stays on device` unless technically true for that flow

## Forms

Privacy contact and delete/export requests should submit as:

- `formType: privacy`
- destination collection: `privacyRequests`
- source domain: `uraiprivacy.com`

Required captured fields:

- name
- email
- request type
- message
- consent/acknowledgement flag
- attribution payload

## Analytics Events

Required events:

- `urai_privacy_passport_click`
- `urai_privacy_data_controls_click`
- `urai_privacy_delete_export_click`
- `urai_privacy_contact_submit`
- `urai_privacy_responsible_ai_click`

## QA Requirements

Before launch-lock:

- verify all public URAI sites can route to this privacy center
- verify privacy request form works or is safely staged
- verify no unsupported privacy/security claims
- verify metadata and OpenGraph tags
- verify mobile readability
- verify accessibility baseline
- run URAI QA checks on output where applicable

## Definition of Done

This repository can move from `planning_locked` to `ready_for_review` only when:

- trust/privacy-only boundaries are preserved
- shared foundation visual rules are applied
- privacy request flow works
- delete/export request path is clear
- claims are launch-safe
- metadata is complete
- analytics events are mapped
- QA checks pass
- production/staging URLs and latest commit are recorded in `URAI_LAUNCH_LOCK_REGISTER.md`
