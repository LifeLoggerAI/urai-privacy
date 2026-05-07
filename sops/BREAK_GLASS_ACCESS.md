# Break-Glass Access SOP

Break-glass access is emergency access to privacy-sensitive URAI systems when normal approval paths are too slow to prevent serious harm, security failure, data loss, or service-critical impact.

## When Allowed

Break-glass access may be used only for:

- active security incident containment
- suspected privacy breach containment
- imminent user safety risk
- critical production outage affecting privacy rights flows
- urgent legal or regulatory preservation need

## When Not Allowed

Break-glass access must not be used for:

- curiosity access
- convenience
- routine support
- analytics exploration
- product debugging that can follow normal approval

## Required Steps

1. Declare break-glass event and reason.
2. Identify incident or emergency ticket.
3. Limit access to the minimum system and data class required.
4. Enable enhanced audit logging.
5. Perform only necessary action.
6. Remove access immediately after containment.
7. Complete post-access review.
8. Create or update incident report if privacy-sensitive data was accessed.

## Required Record Fields

- actor
- system
- reason
- incident ID or emergency ticket
- data classes accessed
- start time
- end time
- reviewer
- actions taken
- post-access decision

## Review Requirements

Every break-glass event must be reviewed within 24 hours or the next business day, whichever is sooner.

## Failure Modes

- Missing reason: treat as policy violation.
- Missing audit trail: create S3+ incident.
- Access not removed: escalate immediately.
- L5 or crisis/safety data accessed: require heightened postmortem.
