# Privacy Feature Manifests

Every product feature that collects, transforms, exports, deletes, shares, or derives user data must have a feature manifest before release.

## Required feature status model

Use exactly one of these status values in each manifest:

| Status | Meaning | Release behavior |
| --- | --- | --- |
| `draft` | Proposal is incomplete or still being designed. | Not releasable. |
| `in_review` | Privacy, security, legal, or product review is underway. | Not releasable. |
| `approved_with_conditions` | Review has approved the feature only with listed mitigations, controls, or launch constraints. | Releasable only when every condition is implemented and verified. |
| `approved` | Review is complete and no open blockers remain. | Releasable when normal engineering gates pass. |
| `blocked` | The feature violates policy, lacks required controls, lacks consent basis, or has unresolved legal/security risk. | Not releasable. |
| `retired` | Feature is removed or disabled and retained only for historical/audit context. | Not releasable as an active feature. |

## Blocked feature status

A feature must be marked `blocked` when any of these are true:

- consent tier or lawful basis is missing or ambiguous
- data minimization, retention, deletion, or export behavior is undefined
- downstream processors or data sharing are not documented
- security rules, authorization checks, or audit logging are incomplete
- public copy implies prohibited claims or unsupported user outcomes
- legal, privacy, security, or product review has not signed off for the intended launch scope

Blocked manifests must include:

- owner
- reason for block
- reviewer or review group
- required remediation
- evidence needed to unblock
- target date or explicit `no_target_date`

## Minimal manifest fields

Each manifest should include:

```yaml
feature: example_feature
owner: product_or_engineering_owner
status: draft
consent_tier: tier_0
purpose: user-visible purpose
data_categories: []
processors: []
retention_class: R0
delete_behavior: user_data_deleted_or_retained_with_reason
export_behavior: included_or_excluded_with_reason
audit_events: []
reviewers:
  privacy: TBD
  security: TBD
  legal: TBD
conditions: []
blockers: []
```

Production release requires every active feature manifest to be `approved` or `approved_with_conditions` with all conditions verified. `blocked`, `draft`, and `in_review` features must remain disabled or unreleased.
