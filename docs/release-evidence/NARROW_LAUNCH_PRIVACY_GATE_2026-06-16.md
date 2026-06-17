# Narrow Launch Privacy Gate — 2026-06-16

## Status

Privacy gate status: conditional.

The narrow public reveal may proceed only for surfaces that remain inside the minimal-data launch spine and pass their own release evidence gates.

The full Tier One through Tier Five ecosystem is not privacy-green until every repo with user, admin, analytics, B2B, provider, content, communication, or generated-asset flows records its own privacy adoption evidence.

## Allowed narrow-launch surfaces

The narrow launch may include:

- static public marketing pages
- early-access signup
- waitlist queue placement
- invite validation
- demo unlock
- conservative `UrAi` V1 app shell
- fallback-safe `urai-spatial` Tier One / Tier Two preview surfaces

These are allowed only when they collect or expose no more than launch-funnel data, demo state, and safe preview/fallback state.

## Blocked until additional proof

The following must stay blocked, preview-only, private, or disconnected until repo-specific privacy evidence exists:

- passive sensing
- raw personal signal ingestion
- private memory ingestion beyond approved demo/fallback data
- admin/operator access to user data
- B2B dashboards
- investor-facing traction claims sourced from user data
- provider-backed content generation using user data
- automated outreach
- analytics dashboards using user-linked records
- asset generation that stores user-private prompts, files, or likeness data
- storytime/communications flows without explicit consent and provider review

## Minimal-data marketing handoff

`urai-marketing` may hand off only minimal launch-funnel records to `UrAi`:

- lead or queue ID
- masked or domain-level email details where possible
- source, medium, campaign, referrer, and referral metadata
- consent/policy version
- invite/demo cohort and status
- timestamps

The handoff must not include private app-state data, precise location history, contact lists, media capture data, device-sensor history, or private memory content.

## `UrAi` and `urai-spatial` launch boundary

`UrAi` may present the canonical V1 app shell only with claims supported by current release evidence.

`urai-spatial` may render fallback-safe preview state and approved app handoff state. It must not become the system of record for sensitive user memory, mood, or personal signal records unless a later privacy gate explicitly approves that ownership change.

## Analytics boundary

`urai-analytics` is not privacy-green for launch until it proves:

- service authentication
- CORS and secret validation
- aggregate-only event handling
- no raw personal signal leakage
- live smoke evidence
- privacy release evidence adoption

Until then, analytics references in other repos must be treated as staging, preview, or disconnected.

## Admin/B2B boundary

`urai-admin` and `B2Bportal` must not be public launch surfaces until they prove:

- authentication
- role checks
- no public admin access
- audit logging
- aggregate-only partner reporting
- legal/DPA/retention review where applicable
- live deploy and rollback evidence

## Required proof before marking full ecosystem green

Every launch-critical repo must record:

- data owned
- data consumed
- data emitted
- forbidden data types
- consent dependency
- retention/export/delete impact
- live smoke proof or explicit disconnected status
- release evidence path

## Current decision

Narrow launch spine: privacy-conditionally allowed if only green surfaces are linked.

Full Tier Four/Tier Five ecosystem: not privacy-green yet.

This file should be updated only with evidence, not optimism.
