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
| C8 | External De-identified Aggregate Use | separately approved public-good research or anonymized monetization purposes | separate purpose-specific opt-in, cohort/privacy controls, revocation |

## C8 remains purpose-specific

C8 is a sensitivity/handling tier, not bundled permission.

A user may grant:

- `research.public-good.aggregate` for privacy-protected public-interest aggregate research;

while separately denying or revoking:

- `data.monetization.anonymized`.

Granting one C8 purpose does not authorize the other.

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

Sensitive inference, biometric identity, AI personalization, public-good aggregate research, and monetization must never be bundled into one all-or-nothing consent prompt.

## Renewal Triggers

Renew consent when:

- Data class changes.
- Purpose changes.
- Retention period increases.
- Sharing or monetization changes.
- A new model infers materially more sensitive attributes.
- Legal or policy version changes materially.
