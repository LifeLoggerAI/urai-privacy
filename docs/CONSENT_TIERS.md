# Consent Tiers

URAI consent must be granular, revocable, logged, and understandable.

## Consent Tier Matrix

| Tier | Name | Authorizes | Requires |
|---|---|---|---|
| C0 | Essential Operations | auth, account security, minimal service logs | clear notice |
| C1 | Personal Memory Storage | transcripts, memories, user content, timeline records | explicit opt-in |
| C2 | Passive Behavioral Context | app/device metadata, notification metadata, interaction rhythms | explicit opt-in |
| C3 | Location Context | GPS, place categories, route/routine inference | explicit opt-in and background control |
| C4 | Sensitive AI Inference | mood, mental load, relationship, crisis, trauma, deception, archetype, shadow signals | separate explicit opt-in and explainability |
| C5 | Biometric Identity | voiceprints, face embeddings, speaker identity, gaze/face inference | separate biometric consent |
| C6 | Personalization / AI Learning | trainable companion memory, tone adaptation, long-term model personalization | explicit opt-in and reset control |
| C7 | Data Export / Portability | structured export of records and consent history | authenticated request |
| C8 | Anonymized Data Monetization | cohort-level, de-identified, non-user-linked pattern products | separate opt-in, revenue ledger, revocation |

## Consent Event Requirements

Every consent change must record:

- `userId`
- `consentTier`
- `status`: granted, denied, revoked, expired
- `policyVersion`
- `surface`: onboarding, settings, feature gate, web, admin
- `timestamp`
- `jurisdiction`
- `evidence`: copy hash or UI version

## Revocation Rules

When consent is revoked:

1. Stop future processing immediately.
2. Queue deletion or de-identification for data no longer authorized.
3. Preserve only minimal audit evidence that consent existed and was revoked.
4. Disable dependent features gracefully.
5. Show the user what changed.

## No Bundled Consent

Sensitive inference, biometric identity, AI personalization, and monetization must never be bundled into one all-or-nothing consent prompt.

## Renewal Triggers

Renew consent when:

- Data class changes.
- Purpose changes.
- Retention period increases.
- Sharing or monetization changes.
- A new model infers materially more sensitive attributes.
- Legal or policy version changes materially.
