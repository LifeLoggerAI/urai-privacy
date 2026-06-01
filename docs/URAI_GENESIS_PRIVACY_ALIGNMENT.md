# URAI Genesis Privacy Alignment

Last updated: 2026-06-01

## Purpose

This document aligns the privacy, consent, and data-governance posture for URAI Genesis with the main app implementation in `LifeLoggerAI/UrAi`.

Genesis must remain privacy-first, user-controlled, and non-diagnostic. User-facing language should describe patterns, signals, reflections, and private life-map moments — not medical conclusions.

## Canonical Genesis consent categories

The main app currently models the following user-controlled categories:

- Audio
- Location
- Motion
- Device Activity
- Notifications
- Calendar
- Contacts
- Health
- Photos
- URAI Passport

These categories should be treated as the canonical Genesis consent set until a shared package or schema registry is introduced.

## Canonical privacy levels

Genesis uses three privacy levels:

- `localOnly`: stays on device/browser storage where possible.
- `privateCloud`: may be stored in the user's private URAI cloud branch.
- `passportShareable`: can only become externally reviewable/shareable through explicit Passport control.

No data should move from `localOnly` or `privateCloud` to `passportShareable` without a user-visible Passport action.

## Main app Genesis Firestore tree

The main app persistence adapter writes to the following structure when Firebase is configured:

```txt
uraiGenesis/{userId}/state/consent
uraiGenesis/{userId}/state/passport
uraiGenesis/{userId}/state/moodWeather
uraiGenesis/{userId}/signals/{signalId}
uraiGenesis/{userId}/reflections/{reflectionId}
uraiGenesis/{userId}/memoryStars/{starId}
```

Privacy and rules documentation should mirror this tree exactly.

## Required policy boundaries

Genesis must not claim to:

- diagnose mental health conditions
- detect lies with certainty
- infer protected traits for decision-making
- share user data outward by default
- sell or expose personal data without explicit user-controlled permission
- collect passive data before clear consent state exists

## Launch requirements

Before Genesis production launch:

- Firestore rules must restrict `uraiGenesis/{userId}` to the authenticated user and admins only where operationally required.
- Consent copy must clearly explain each category.
- Passport copy must clearly state private/review/shareable modes.
- Data export and deletion request paths must be documented.
- Any passive capture adapter must check consent before capture, storage, or analysis.
- Marketing/investor copy must avoid therapy, diagnosis, and certainty claims.

## Cross-repo obligations

- `LifeLoggerAI/UrAi`: implement consent, Passport, and data storage exactly as documented.
- `LifeLoggerAI/urai-admin`: surface audit and deletion/export support without bypassing user ownership.
- `LifeLoggerAI/urai-analytics`: aggregate only consented data and prefer privacy-preserving metrics.
- `LifeLoggerAI/urai-marketing`: communicate value without overclaiming medical or surveillance capabilities.
- `LifeLoggerAI/urai-investors`: explain Passport and privacy moat accurately.
