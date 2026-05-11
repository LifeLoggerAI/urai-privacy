URAI Privacy Center — SOC-2 Type II Readiness Packet
System: URAI Privacy Center (urai-privacy)
Version: v1.0.1
Scope Period (recommended): 6–12 months

A. System Description (SOC-2 §A1)
Purpose
URAI Privacy Center governs data subject rights, consent enforcement, audit logging, and policy transparency across all URAI systems.

Core Capabilities

DSAR (Export / Delete) execution

Consent management & revocation

Immutable audit logging

Versioned privacy policies

Role-gated admin execution

B. Trust Services Criteria Mapping
Security (Common Criteria)
| Control | Evidence |
| :--- | :--- |
| CC6.1 Logical access | Firebase Auth, IAM roles |
| CC6.2 Role separation | Admin role gating |
| CC6.7 System security | App Check + Firebase security rules |
| CC7.2 Logging | Immutable auditLogs |
| CC7.4 Incident traceability | Event-level audit trails |

Availability
| Control | Evidence |
| :--- | :--- |
| A1.1 System uptime | Firebase Hosting + Functions |
| A1.2 Failure handling | Fail-closed DSAR execution |
| A1.3 Recovery | Idempotent request execution |

Confidentiality
| Control | Evidence |
| :--- | :--- |
| C1.1 Data access limitation | Auth-scoped DSAR |
| C1.2 Secure delivery | Expiring signed URLs |

Privacy
| Control | Evidence |
| :--- | :--- |
| P1.1 Notice | Public policy registry |
| P2.1 Consent | Versioned consent scopes |
| P4.1 DSAR | Export / Delete workflows |
| P6.1 Retention | Deletion + tombstoning |

C. Auditor Evidence Index
/functions/dsar/*

/lib/consent/*

/lib/audit/*

/public/transparency.json

/CHANGELOG.md

/governance/LOCK.md

D. Gaps (Explicit & Acceptable)
Cross-repo data aggregation connectors may be stubbed but structured

Incident response runbook maintained at URAI Labs level

Readiness Status:
🟢 Ready for SOC-2 Type II observation period
