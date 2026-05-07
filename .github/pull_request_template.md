# Privacy Governance Change

## Summary

Describe what changed and why.

## Change Type

- [ ] Policy / governance documentation
- [ ] Legal template
- [ ] Schema contract
- [ ] API contract
- [ ] Adoption template
- [ ] CI / validation
- [ ] Incident / audit / compliance process

## Privacy Impact

- [ ] No user data impact
- [ ] Changes collection boundaries
- [ ] Changes consent requirements
- [ ] Changes retention or deletion behavior
- [ ] Changes export or portability behavior
- [ ] Changes anonymization or data-sharing behavior
- [ ] Changes biometric or sensitive inference handling
- [ ] Changes audit or incident response behavior

## Required Checks

- [ ] Data classes are still defined for all relevant data.
- [ ] Consent tiers remain granular and revocable.
- [ ] No silent escalation of data use is introduced.
- [ ] Retention/deletion guarantees are preserved or improved.
- [ ] Legal/regulatory notes are marked for counsel review where needed.
- [ ] Validator passes: `python tools/validate_privacy_package.py`.

## Reviewer Notes

List any open questions, risks, or follow-up actions.
