# R849 — Legacy export callable retirement / broker-only delivery (RELEASE HOLD)

**Date:** November 7, 2026. **Parent:** R848 PR #243 head `ec71f15a545288685b4bd5846ecf88cdb3314e5c`. **Classification:** independently reviewed source hardening, not deploy/runtime certification.

## Exact source fix

Prior R848 `functions/src/index.ts` still exported a legacy `processExportRequest` and `getExportDownloadUrl`; the latter called `getSignedUrl({action:"read"})` to issue a GCS bearer capability without current canonical C7 consent, account authority, or deletion fence revalidation. These exports were **not** in the configured production `functions/src/functions-entry.ts`, but constituted a dangerous alternative export surface if accidentally reintroduced. This is evidenced source exposure potential, **not proof of actual deployment or leaked media**.

R849 removes both legacy callables, their unneeded request schemas, signed-URL TTL constant and obsolete owner/admin helper from `functions/src/index.ts`. The configured Functions entry still exports `processExportRequest` from `export-request.ts`, and `downloadExportPackage` plus consent-bound descriptor from `export-lifecycle-functions.ts`. The newer broker, C7 projection, C6/JOBS verifier, R848 deletion Auth/lease protections, Firestore v3 version guards, GCS generation preconditions and eight-contributor global deletion-completion blocker remain source-present. No production code or deployment changed.

**Exact Git blobs:** modified `functions/src/index.ts` `fe06e79254c8daad6deb27798048437662bd502e`; `functions/src/functions-entry.ts` `9c5cf07fc46f996953018f681604f80f37b2f1e2`; `functions/src/export-request.ts` `ecc52dd51721b5d910ee69ac8e5cf942d7c7b40d`; broker `functions/src/export-lifecycle-functions.ts` `57612fe96c7fb16ed4e4f014ac1abbb030f4eb64`.

New `scripts/assert-no-legacy-export-callables.mjs` Git blob `f0e48b760eb7445d17ede8b64186a0a83f479933` and `tests/no-legacy-export-callables.test.mjs` Git blob `2160ec98db09844beb28f48c0591f1ba8c678537` require canonical broker/processor exports and reject a resurrected raw GCS URL, legacy callables, wildcard re-export, missing broker and missing v4 deletion source. Both are wired to `scripts/verify-release.sh` blob `43a7fda5f7abac7126e94fba11587344b22031a8` and `scripts/security-gate.sh` blob `25ac4c52fec60bc97adb9e776ce96271c8476067`.

## Evidence

- **12/12 PASS** original local Node 22.16.0 pure fixture/regression suite. Both committed Git blobs matched local `git hash-object`. This does **not** test a deployed broker.
- **13/13 PASS static source-readback conditions**: old exports and `getSignedUrl` absent in index, canonical broker/processor present, no broker raw URL, v4 deletion and current-authority source preserved, both release/security gate hooks present. This is text-level inspection only.
- Re-ran R848 original standalone lease suite locally **19/19 PASS** and pure TypeScript check PASS separately, not a rerun of the R849 complete source.
- **No R849 full frozen root/Functions build, Firebase Rules/four-emulator acceptance, live signed C6 grant, provider IAM, private Studio→Jobs→Replay, race checks or physical device proof.**

## Newly observed CI source mismatch (separate repair required)

Existing `.github/workflows/privacy-release-verification.yml` and `.github/workflows/release-verify.yml` use Node `20.19.0` while `functions/package.json` declares Node 22 and the R846/R847 release verifier invokes `node --experimental-strip-types`. This will block parts of the release gate on the older runner if execution reaches these steps. Its relationship to the currently reported failed jobs *with no visible steps* remains unproven. Repair in an isolated reviewed child with Node 22, verify all relevant workflow entries, then run exact-source installs and tests; do not mark no-step CI failures as application test failures.

**P0:** native builds, original Firebase emulators, real authenticated owner/foreign/revoked/disabled rights, signed positive C6 owner grant, protected media and cancellation/deletion/ACKs, independent production authorization. **RELEASE HOLD.**
