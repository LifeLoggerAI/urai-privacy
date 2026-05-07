# Employee Access Removal SOP

This SOP defines how URAI removes access when an employee, contractor, vendor, advisor, or service operator no longer needs access.

## Triggers

Access removal is required when:

- employment or contract ends
- role changes
- project access is no longer needed
- vendor engagement ends
- security or privacy incident requires access suspension
- temporary or break-glass access expires

## Required Removal Checklist

- [ ] Remove GitHub repository access.
- [ ] Remove Firebase / Google Cloud access.
- [ ] Remove admin console access.
- [ ] Remove analytics dashboard access.
- [ ] Remove vendor dashboard access.
- [ ] Remove production database access.
- [ ] Rotate shared credentials if any existed.
- [ ] Disable service accounts or keys no longer needed.
- [ ] Remove access to incident, audit, or legal records if no longer appropriate.
- [ ] Confirm removal with reviewer.

## High-Risk Access

The following access should be removed or reviewed immediately:

- access to L3-L6 data
- access to biometric records
- access to crisis, safety, or mental health signals
- access to data-sharing or monetization ledgers
- access to audit logs
- access to production deletion/export jobs

## Required Record Fields

- person or vendor
- systems removed
- removal trigger
- removal date
- reviewer
- exceptions
- credential rotation status
- follow-up actions

## Timing

High-risk access should be removed immediately. Standard access should be removed no later than the end of the final workday or contract end date.

## Failure Modes

- Unknown access inventory: create security/privacy issue.
- Shared credential found: rotate immediately and review usage.
- Former operator retains access: create incident report.
