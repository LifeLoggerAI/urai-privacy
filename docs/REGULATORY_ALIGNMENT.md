# Regulatory Alignment Map

This document maps URAI privacy controls to common regulatory obligations. It is implementation guidance and must be reviewed by qualified counsel before production launch in each jurisdiction.

## GDPR / UK GDPR Alignment

| Obligation | URAI Control |
|---|---|
| Lawful basis | Consent tiers and explicit purpose records |
| Data minimization | data classification, default deny, collection boundaries |
| Purpose limitation | purpose metadata on every field and consent event |
| Access and portability | export jobs and data export standard |
| Erasure | deletion jobs and derived data deletion rules |
| Special category risk | sensitive inference and biometric controls |
| Records of processing | data processing records and audit logs |
| Breach response | incident response playbook |

## CCPA / CPRA Alignment

| Obligation | URAI Control |
|---|---|
| Notice at collection | consent surfaces and legal notices |
| Right to know | export standard |
| Right to delete | deletion workflows |
| Right to opt out of sale/share | monetization consent tier and revocation |
| Sensitive personal information controls | sensitive inference and biometric tiers |
| Non-discrimination | no dark patterns and no degraded essential service for refusing non-essential consent |

## Biometric Privacy Alignment

Any voiceprint, face embedding, speaker identity, gaze vector, or biometric identity vector must use:

- separate opt-in
- clear purpose
- shortest feasible retention
- independent deletion
- no sale or license of raw biometric identifiers
- audit logs for access and processing

## Children's and Minor Safety

URAI must not launch child-directed collection without a separate child privacy program, parental consent flow where required, and stricter retention and monetization prohibitions.

## Mental Health / Sensitive Inference Risk

URAI's mood, crisis, trauma, shame, burnout, deception, relationship, and cognitive inference systems must be treated as sensitive even where a jurisdiction has no exact matching category.

## Legal Review Triggers

Require legal review before:

- Launching in a new jurisdiction
- Adding biometric processing
- Adding data monetization or licensing
- Processing minors' data
- Expanding sensitive mental health or crisis inference
- Changing deletion or retention guarantees
