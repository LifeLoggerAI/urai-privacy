# Data Classification Standard

URAI data must be classified before collection, inference, storage, export, sharing, or monetization.

## Classification Levels

| Level | Name | Examples | Default Handling |
|---|---|---|---|
| L0 | Public / non-user data | Public app copy, documentation | No user consent required |
| L1 | Account data | Email, display name, auth UID | Required for account operation |
| L2 | Behavioral metadata | app usage, timestamps, interaction counts, notification metadata | Consent required unless strictly operational |
| L3 | Personal content | audio transcripts, journal text, uploaded content, conversations | Explicit consent required |
| L4 | Sensitive inference | emotional state, mental load, relationship insights, crisis indicators | Explicit granular consent and explainability required |
| L5 | Biometric / identity signal | voiceprint, face embedding, gait, speaker identity | Separate explicit opt-in; image/audio minimization required |
| L6 | Monetizable anonymized data | cohort-level patterns, de-identified aggregates | Separate opt-in and revenue ledger required |
| L7 | Restricted / prohibited | raw sold biometric identity, hidden collection, unrevocable consent | Not allowed |

## Required Metadata Per Data Field

Every stored or derived field must declare:

- `dataClass`
- `purpose`
- `consentTier`
- `retentionClass`
- `exportable`
- `deletable`
- `monetizable`
- `aiTrainingAllowed`
- `adminAccessible`
- `auditRequired`

## Sensitive Inference Rule

URAI must treat inferred emotional, mental health, relationship, behavioral, or biometric attributes as sensitive even when the raw source signal appears ordinary.

Example: a tap pattern may be low-risk metadata by itself, but a derived anxiety, burnout, shame loop, or crisis signal is L4.

## Default Deny

If a data field is not classified, it must not be collected or processed.
