# Privacy deletion-orchestration reconciliation

- Canonical privacy authority base: `ff741bd52534ca60135bd1fa997f9ffd1e930f4b`
- Retained deletion source: `eaada05c27822318dd6946189bea75af7aefa9e3`
- Original trigger SHA: `0109dd0c8bf71506e9414d2b6436ff290595958a`
- Dependency-remediation source head: `d2c3612a2a1f314424e11f57ae7b0700f8dd1aff`
- Reconciliation mode: partial
- Live privacy operation: false
- Firebase deployment: false
- Credential mutation: false
- Production-data mutation: false

The clean, unique deletion-orchestration files were transferred into the canonical Privacy authority.

When reconciliation mode is partial, canonical #82 versions were deliberately retained for these sensitive shared paths pending focused privacy/security review:

- `app/privacy-center/consent/page.tsx`
- `firestore.rules`
- `src/lib/firebase-privacy-client.ts`

The Functions package boundary is now dependency-remediated rather than unresolved:

- root Vitest updated to `4.1.10`;
- root test dependency on `firebase-functions` made explicit at `6.6.0`;
- root and Functions override vulnerable transitive `uuid` to `11.1.1`;
- no forced or breaking audit fix was used;
- root and Functions `npm audit` report zero vulnerabilities;
- 20 test files and 118 tests passed in the remediation candidate;
- root and Functions typechecks passed;
- permanent emulator workflows remain separately required and are not replaced by this package evidence.

Dependency evidence:

- artifact `8328669717`;
- digest `sha256:8502907f23fedaea7d1561ce132bac49d406025f6bcb58c152c5776ffd65f42d`.

This receipt does not claim live privacy certification. Exact-head permanent workflow success, downstream adapter review, protected staging, independent legal/privacy/security approval, deployment, recovery and rollback proof remain required before consumption into PR #82.
