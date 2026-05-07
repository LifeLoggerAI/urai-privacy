# Admin Access Approval SOP

This SOP defines how URAI approves, reviews, grants, and audits admin access to user data or privacy-sensitive systems.

## Scope

Applies to:

- `urai-admin`
- production consoles
- analytics tools
- support tooling
- Firestore or database consoles
- vendor dashboards that expose URAI user data

## Approval Requirements

Before admin access is granted:

1. Access purpose is documented.
2. Role and permission scope are minimized.
3. Data classes accessible are documented.
4. Duration is time-bound.
5. Reviewer approval is recorded.
6. Audit logging is confirmed.
7. Access removal date or review date is set.

## Required Record Fields

- requester
- approver
- system
- role
- data classes
- purpose
- start date
- end date or review date
- approval status
- audit event type

## Rules

- Curiosity access is prohibited.
- Admin access to L3-L6 data requires explicit purpose.
- Admin access to L5 biometric data requires heightened approval.
- Admin access to crisis, safety, or mental health signals requires privacy/security review.
- Access must be removed when no longer needed.

## Audit Events

Admin access must emit `admin.user_data_accessed` with purpose, actor, target, data classes, source service, and policy version.

## Review Cadence

High-risk admin roles should be reviewed at least monthly. Lower-risk roles should be reviewed at least quarterly.
