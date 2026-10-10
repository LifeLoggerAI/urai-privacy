# Release Blockers

Date: 2026-10-07

Source verification and production readiness are separate gates. Current source includes locked framework/SDK remediation, loaded Functions integration tests, export attempt fencing, deletion orchestration, and authenticated export delivery. The security gate reports findings and enforces the existing critical threshold; fresh full root/Functions audits returned zero findings during this repair.

Remaining release evidence:

- Exact-source native workflows must pass, including the loaded Java 21 Firebase emulator suite. Local loaded verification is blocked by this workspace's Unix-socket restriction, not counted as a pass.
- All consumers of the export descriptor must use authenticated delivery. Legacy packages without receipt/deadline binding fail closed; previously issued signed URLs require their existing expiry/object-deletion transition to be accounted for.
- Confirm the intended production Firebase project, deployed source/build/rules parity, and configured environment through the authorized operator.
- Record current authenticated live export/grant/withdrawal/delete/legal-hold/admin-denial proofs, monitoring, rollback, and release-owner/security/privacy/legal/support approvals.

`npm run verify:release`, current live smoke and authenticated proof, and the release signoff controls remain required. Passing repository checks or zero audit findings alone does not establish production readiness or Golden Master certification.
