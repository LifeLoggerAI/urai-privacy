# R583 — Converged Privacy ↔ Jobs264 review, independent dual manifest (HOLD)

This is a **review-only, credential-free** manual reconciliation of two separately tested but diverged branches:
- Privacy #211 SHA `5398c1cea889d331c7b8288baa265fd9d76c1ced`: original corrected Java 21 unit gate and native original 23/23 Auth/Firestore/Storage/Functions emulator.
- Privacy #210 SHA `b15e23bc9e65bd27772c7719f972c3b286b32a12`: independently reproduced Jobs #264 70-file compiled artifact under a distinct canonical inventory serializer.

**Decisions:** The #211 working Firebase fixture, source pin, original checkout identity, compiled-JS comparison and 23/23 synthetic acceptance are kept unchanged in source A. #210's standalone v2 Jobs264 inventory and independently reproduced expected SHA256 are imported, with no self-derived expected digest allowed; its six-file-only test fixture is upgraded to assert all ten exact Jobs264 source blobs from #211. The maintained native unit suite now enrolls the additional detached-checkout and independently generated artifact negative tests. The alternate runner and overlapping checkout/build bridge source from #210 are **not** promoted over #211's proven implementation. No production source, Firebase Rules, IAM, signed grants or rendering code changes.

The actual disposable runner is separately anchored (next review commit) to this exact source A and requires **both** independent manifest fingerprints before invoking the original four emulators:
- Existing R575 source #211 manifest SHA256: `423d58cb656b7545c1951a8338e5f6bce3bb53eccabec3879374970bdbc02049`.
- Independent R580 source #210 manifest SHA256: `82cb12511af2e1d800819e2ed73222cefabee43798d4ff3d60277f65656f4ba0`.
- Both represent the same 70 compiled source artifacts with expected tree SHA256 `c7280667ade99c531a275b22cdd21fa39c058c18599e3137de35025825e36278`, size `455148` bytes, Jobs source `e2a700bd186c4dcff47c6da763e647992145d8b0`.

Source A needs a new exact-head local unit + true original four-emulator run; the old green results are not promoted to the merged source. The final runner is a separate child whose source pin stays fixed to A; tests on the child are separate. GitHub-required protected CI and nonauthor human approval still needed.

**Critical release blocker:** The existing Storage negative proof demonstrates the privileged old Admin writer can create objects *after* consent revocation in an emulator. No cloud broker-only GCS IAM, signed owner C6 grant, active-upload drain, old-writer denial, exact-generation deletion or private authenticated Replay has been proved. **GENESIS G0–G7 HOLD — no merge, no deploy, no production authority.**
