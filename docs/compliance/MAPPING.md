Unified Compliance Mapping — URAI Privacy Center (v1.0.1)
| Requirement | SOC 2 (TSC) | GDPR | CCPA/CPRA | URAI Implementation |
| :--- | :--- | :--- | :--- | :--- |
| Data minimization | CC6.1 | Art. 5(1)(c) | §1798.100 | Scoped collection; consent-gated usage |
| Purpose limitation | CC6.1 | Art. 5(1)(b) | §1798.100 | Explicit consent scopes; enforced revocation |
| User access rights | CC2.1 | Art. 15 | §1798.110 | DSAR Export (authenticated, logged) |
| Right to deletion | CC8.1 | Art. 17 | §1798.105 | DSAR Delete with certificate |
| Consent tracking | CC6.3 | Art. 7 | §1798.120 | Versioned consentHistory |
| Consent withdrawal | CC6.3 | Art. 7(3) | §1798.120 | Immediate revoke → fail-closed |
| Audit logging | CC7.2 | Art. 30 | §1798.185 | Immutable auditLogs |
| Security safeguards | CC6.7 | Art. 32 | §1798.150 | Firebase IAM + App Check |
| Breach traceability | CC7.4 | Art. 33 | §1798.150 | Event-level audit trails |
| Policy transparency | CC1.2 | Art. 12–14 | §1798.130 | Public policy registry |
| Versioned policies | CC1.2 | Art. 12 | §1798.130 | policyDocs w/ versioning |
| Non-sale of data | N/A | Art. 6 | §1798.140 | Locked principle |
| DSAR SLA | CC2.2 | Art. 12(3) | §1798.130 | Enforced + disclosed |
| Role separation | CC6.2 | Art. 24 | §1798.185 | Admin role-gating |
| Change governance | CC1.3 | Art. 25 | §1798.185 | LOCK.md enforced |

**Status:**
- ✔ Fully implemented
- ✔ Enforced by code
- ✔ Auditable
