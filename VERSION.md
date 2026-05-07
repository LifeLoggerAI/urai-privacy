# URAI Privacy Governance Version

Current governance version: **0.1.0-draft**
Effective status: **Draft for implementation review**
Owner: **URAI Privacy / Governance**
Applies to: **All URAI ecosystem repositories and services**

## Versioning Rules

URAI Privacy uses semantic governance versioning:

- **Major**: Breaking privacy or consent model changes, new categories of sensitive data, or materially different user rights.
- **Minor**: New policy modules, new data classes, new audit requirements, or new integration contracts.
- **Patch**: Clarifications, wording fixes, non-material checklist updates, or implementation guidance.

## Required Adoption

Every URAI repo must declare the privacy governance version it implements. A repo is not release-ready unless its implemented privacy version is equal to or newer than the minimum required version declared here.

## Current Minimum Required Version

- Apps: `0.1.0-draft`
- Admin tools: `0.1.0-draft`
- Analytics systems: `0.1.0-draft`
- Data export systems: `0.1.0-draft`
- Monetization systems: `0.1.0-draft`

## Change Approval

Changes to this repo should be reviewed for:

1. User consent impact
2. Data minimization impact
3. Regulatory impact
4. Security/audit impact
5. Monetization/data-sharing impact

No product feature may silently escalate data collection, inference, retention, sharing, or monetization beyond the active version of this governance package.
