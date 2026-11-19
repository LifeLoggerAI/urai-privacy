# R1586 — review-only Privacy → real Jobs handler contract test

**HOLD / NO-GO.** This review branch is based on Privacy #328 exact `28e369cee5963340bb985a329a969659c0753e85`. Jobs source must be the existing draft #501 exact `501520051909534ccf004e03152431392392e1ab`. No dispatcher, production IAM, live data, deployment, private-memory writes, or merge is authorized.

## What this adds

`tests/integration/r1586-privacy-jobs-real-handler.emulator.cjs` is a synthetic **native dual-project emulator** test designed to exercise these actual handlers:
1. Privacy `setCanonicalConsent` grant → revoke and Firestore `publishConsentRevocation` trigger;
2. Privacy #328's source-bound `projectCanonicalJobsV2Revocation`;
3. Jobs #501's actual HTTP `ingestConsentRevocation` with test bearer, including negative admission and duplicate/conflict;
4. Jobs Firestore block/receipt readback in its separate disposable project;
5. Privacy `acknowledgeConsentRevocation` callable with synthetic consumer-bound Firebase ID token, immutable ACK/audit semantics.

The test intentionally treats `blocked` as **consent-block-only evidence** and refuses to claim physical deletion, write fencing, production IAM or cloud authentication from a 200 response.

## Exact source and prerequisites

Execute with **two separate isolated Firebase emulator groups on loopback**: Privacy project `urai-privacy-r1512-disposable` at Auth 9099, Functions 5001, Firestore 8080, Storage 9199, and Jobs project `demo-urai-jobs` at Functions 5101, Firestore 8180, plus isolated Jobs Storage (not the Privacy Storage host). Jobs `functions` must be compiled and the Firebase emulator must load its real exported handler. The Jobs runtime must have only the disposable `URAI_JOBS_PRIVACY_EVENT_TOKEN=r1586-disposable-test-only-bearer`, never a real secret. Run in a network-isolated runner without credential variables and without production Firebase project aliases.

The parent Privacy repo's test uses its already-pinned npm dependency graph. The Jobs repo uses its pinned pnpm graph. Preserve the existing R1584 and R1585 acceptance tests; do not rerun them just to inflate passing totals.

Set only these test controls for the native R1586 script:

```sh
URAI_PRIVACY_EXACT_SHA=28e369cee5963340bb985a329a969659c0753e85
URAI_JOBS_EXACT_SHA=501520051909534ccf004e03152431392392e1ab
GCLOUD_PROJECT=urai-privacy-r1512-disposable
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
URAI_R1586_JOBS_FUNCTIONS_ORIGIN=http://127.0.0.1:5101
URAI_R1586_JOBS_FIRESTORE_ORIGIN=http://127.0.0.1:8180
```

The runner must confirm both checked-out Git trees before invoking the script, and use a clean working tree with no cloud credentials. The test source asserts the exact expected SHA **environment values**, not live source ancestry; the launcher must independently verify each `git rev-parse HEAD`.

**Important:** Do not execute the script by itself against existing services. Start explicit, separate disposable Jobs and Privacy Firebase emulators, prove the intended endpoint/project mapping, and stop if any service identity or port is uncertain. Do not reuse production credentials, signed identities or buckets.

## Status

- GitHub review-only test source: **published**.
- Executable syntax and complete dual-emulator integration on the **published GitHub source**: **NOT YET EXECUTED**.
- Local preliminary harness syntax verified separately; that is **not** evidence of the published source or its end-to-end correctness.
- Existing Privacy R1584 16/16 and R1585 17/17 reported acceptance: historical separate candidates, **not transferred** to R1586.
- Deployment, production IAM, actual identity federation, private deletion, stale-writer denial, live rollback, independent approval: **NOT CERTIFIED**.

## Next required evidence

A clean exact-head native runner must record its source SHAs, port/project IDs, zero production credentials, full test exit code, stdout/stderr SHA-256, Jobs receipt + block and Privacy ACK outcomes. A failed script is not a PASS. Review the exact `applied` mapping separately: this candidate's detail hash represents a **Jobs consent block**, never completed deletion. Do not publish an operational dispatcher or change production configuration from this review PR.

Production: **HOLD / NO-GO**. Private-memory writes: **DISABLED**.
