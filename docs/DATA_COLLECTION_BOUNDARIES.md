# Data Collection Boundaries

URAI is passive by design, but passive collection must never mean invisible, unlimited, or irreversible collection.

## Allowed Collection Conditions

A signal may be collected only when all conditions are true:

1. The data class is defined in `DATA_CLASSIFICATION.md`.
2. The purpose is specific and user-facing.
3. The active consent tier authorizes the collection.
4. The retention class is known before storage.
5. The user can later export and delete the data unless a documented legal exception applies.
6. The collection does not create a hidden escalation path to more sensitive inference.

## Default Prohibitions

URAI must not:

- Collect raw microphone, camera, biometric, or location data without explicit opt-in.
- Infer sensitive mental, emotional, relational, or identity attributes without a clear consent path.
- Sell, license, or share user-linked records.
- Store raw biometric templates unless the user explicitly opts in and retention is minimized.
- Convert a low-risk feature into a high-risk inference system without renewed consent.
- Use dark patterns to pressure consent.

## Source-Specific Boundaries

### Audio and Transcripts

- Raw audio should be ephemeral by default.
- Transcripts are personal content and require explicit consent.
- Speaker identification and voiceprints require separate biometric consent.

### Location

- Fine location requires explicit opt-in.
- Background location must have a specific purpose and visible control.
- Location-derived inferences, such as routine, isolation, or risk states, require sensitive inference consent.

### Device and App Metadata

- Operational telemetry may be collected minimally for service reliability.
- Behavioral interpretation of usage patterns requires behavioral consent.
- Sensitive interpretation, such as overstimulation or burnout, requires sensitive inference consent.

### Face, Camera, and Biometric Signals

- On-device inference is preferred.
- Raw images should not be stored unless explicitly necessary and separately consented.
- Embeddings are biometric data and must be treated as L5.

### Monetization Signals

- Data monetization must be opt-in, revocable, cohort-level, and audited.
- Monetization must never use raw identity-bearing data.

## Escalation Rule

When a new feature changes the purpose, sensitivity, retention, or sharing of data, the user must be asked again before processing continues.
