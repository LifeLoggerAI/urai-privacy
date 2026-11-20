# R852 — Export processor C7 projection ownership (RELEASE HOLD)

November 7, 2026. Engineering [Privacy draft PR #247](https://github.com/LifeLoggerAI/urai-privacy/pull/247) exact head `5237ebbbe9131d152968004c359b215a6a79bab8`, stacked on R851 #246 `2a05f7a9a08e2f060a929549c18de82bc9a41103`. Earlier branches/PRs and production remain unchanged.

## Source investigation

Previously the actual `functions/src/export-request.ts` worker checked whether current canonical C7 granted consent was valid but did NOT require the matching preexisting C7 tombstone projection before acquiring an export processing claim. Worse, a privileged worker wrote `exportConsentStatus: "granted"`, `exportConsentReceiptHash`, `exportConsentPolicyVersion` and `exportConsentExpiresAt` to the tombstone itself. Only the canonical owner consent transaction is supposed to create positive consent authority. The worker additionally checked request UID/type but not a permitted request state. These are source-level authorization defects; no production leak is established.

R852 removes this worker-side grant projection, refuses cancelled/revoked/failed/completed/mismatched request and job states, and requires both the current canonical C7 consent receipt and exactly matching previously-issued tombstone projection at claim, ongoing private data collection and final publication. The same strict deletion state and current actor checks remain in place.

## Exact source and evidence

- `functions/src/request-admission-policy.ts` Git blob `c05f9583f44348d9908db4d09ebf99e2d495213c` adds fail-closed `exportProcessingRequestStateBlockReason`.
- `functions/src/export-request.ts` Git blob `c73d62f1af788eb9559469f9268657e81dc65bf0` integrates the policy and C7 projection verification into claim, active authority and publication checks.
- Local original Node22.16.0 pure policy tests **33/33 PASS** (R851 21 + new 12), strict TypeScript pure policy module check PASS; exact Git SHA-1 of new test `tests/export-processing-claim-policy.test.mjs` `f69672e40b363cd996f766f94227dcad3d5602ad`; original old test blob `e3c217f082150b009560b8e2a8541f77a807c1bf`.
- Five new source-contract tests `tests/export-processing-c7-source-contract.test.mjs` Git blob `557d1dd7005c9d518b6f753854e7dfea390e31f1` wired in release verifier `df4d91de4fe9125f512919139603668d8f34f0ec` and security gate `10ef3471b3ea8c09f3d9514735e9e8da36c087c0`. These five source contracts have NOT been executed as part of a complete repo checkout. Independent connected GitHub source readback: **14/14 static source conditions observed**.
- R852 GitHub hosted workflow run IDs: Production Verify `42413074578`, Consent Branch Validation `42413074640`, Privacy Release Verification `42413074563`, Release Verification `42413074515`, Privacy package validation `42413074553`. All reported failure. Release job `128525168462` has **no visible steps**. Root cause unproven; no native source test pass/fail can be inferred.

## Remaining release-critical blockers

Exact-head clean root/Functions builds, original Firebase Auth/Firestore/Storage/Functions four-emulator and real consent/revocation races, positive signed owner-approved C6 movie consent issuer, source ownership, Studio→Jobs→Replay protected private rendering, IAM proof, GCS object-generation-safe cleanup/download, eight downstream deletion ACKs, physical devices, and independent production GO remain UNPROVEN. This review does not fix generation-unpinned cleanup or legacy storage capabilities. No production deployment, account deletion, IAM mutation, private data access, paid compute or merge occurred.

**ONE URAI GENESIS RELEASE HOLD.**
