# Security and Privacy Review Template

Use this review for any URAI feature, service, vendor, or data pipeline that processes L3-L6 data or touches consent, deletion, export, audit logs, admin access, AI inference, location, or biometrics.

## System Overview

- Name:
- Owning repo:
- Owner:
- Reviewer:
- Review date:
- Governance version:

## Architecture

Describe:

- services involved
- data stores involved
- queues or background jobs
- third-party services
- admin tools
- user-facing controls

## Data Flow

- Source data:
- Derived data:
- Stored data:
- Exported data:
- Deleted data:
- Audit events:

## Access Control

- User access model:
- Admin access model:
- Service account access:
- Least privilege notes:
- Break-glass access path:

## Threats and Controls

| Threat | Control | Owner | Status |
|---|---|---|---|
| Unauthorized admin access |  |  |  |
| Consent bypass |  |  |  |
| Deletion failure |  |  |  |
| Sensitive inference leakage |  |  |  |
| Biometric template exposure |  |  |  |
| Re-identification |  |  |  |
| Vendor misuse |  |  |  |

## Logging and Monitoring

- Audit logs emitted:
- Alerting required:
- Incident severity mapping:
- Retention of security/privacy logs:

## Decision

- [ ] Approved
- [ ] Approved with conditions
- [ ] Blocked

Required conditions:
Follow-up date:
