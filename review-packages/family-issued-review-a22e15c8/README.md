# ONE URAI — isolated issued Family Stories path

**Production HOLD / NO-GO. Private-memory writes OFF.**

This review package adds an authenticated synthetic issuer, immutable decision/outbox, authenticated loopback delivery receiver, story-scoped withdrawal and subject deletion propagation. It uses the existing Storytime #120 consumer and Privacy #335 receipt serializer unchanged.

The ordinary canonical Privacy registry still rejects `storytime.family_share`. Positive review requests require an explicitly named emulator-only policy fixture. This package is not an authorized canonical issuer, cloud signer, production service identity, deployable integration, or completed global deletion implementation. It must not be used with real family records.

## Source custody

| Component | Base implementation commit | Base tree |
| --- | --- | --- |
| Storytime #120 | `cc0baee8a4b2bafc452b3e097b1f8770227d4cb7` | `61ed8d6c784a5ca2d1733b19173b1709d403e6f0` |
| Privacy #335 | `8f79ade634a14fa31f8428e84b01f71cecec8d7e` | `197eefb12a4fe2896df7c364a6018437317fe6b4` |

The current review heads `a626d8c626b408453ba84bbb53bb55182d0fa581` and `a59f78271c69b0fe62556971f9fd87d1d84f2584`, respectively, add documentation only after those implementation commits.

The package overlays exactly one new module per archived service. Neither module is exported by the service's ordinary Functions entrypoint. `fixture/functions/index.cjs` permits metadata loading only under the standard exact demo project and emulator configuration. Each new callable independently requires the full activation, policy and fixed-host guards before any writes. The generated source manifest records base trees, overlay Git blobs/SHA-256, proposed runtime trees, unchanged dependency lock hashes and all execution harness hashes.

## Implementation

- `privacy/functions/src/family-story-share-issued-review.ts`: current owner authentication, explicit exact text/recipient approval, current source checks, scoped signed receipt, immutable decision/outbox, idempotency, signed withdrawal/deletion events and a fixed destination dispatcher.
- `storytime/functions/src/family-privacy-delivery-review.ts`: current fixed synthetic delivery actor, independently encoded and verified event envelope, existing inner receipt verifier, source/fence/revision checks, server-only receipt persistence, terminal withdrawal, fence-first scoped authority purge and retry handling.
- `tests/family-issued-path.emulator.cjs`: actual HTTP callable lifecycle. Admin SDK seeds only inert source documents and synthetic Auth accounts/claims. It does not create the positive receipt, withdrawal fence or deletion tombstone, read a private signing key, or sign events.
- `CONTRACT.md`: exact inputs, signed field order, state semantics and bounded scope.

The existing Storytime owner grant callable remains a separate step after delivery. The receiver does not silently create a family access grant. No raw recordings, photographs, storage URLs or additional family member data are returned.

## Reproduction on an existing authorized worker

Preparation requires locally available exact Git objects and existing dependency directories with byte-identical lockfiles. It refuses an existing output directory and performs no fetch, install, branch mutation, deployment or policy registration.

```bash
python3 prepare-isolated-review.py \
  --storytime-source /workspace/r1586-forward/storytime-family-signed-convergence-review \
  --storytime-dependencies /workspace/r1586-forward/storytime-family-signed-convergence-review \
  --privacy-source /workspace/r1586-forward/privacy-family-wire-review \
  --privacy-dependencies /workspace/r1586-forward/privacy-family-wire-review \
  --output /workspace/r1586-forward/family-issued-review-NEW-UNIQUE-DIRECTORY
```

The output's `start-review-detached.py` starts its bounded runner. The runner compiles both services, verifies all review callables and Storytime grants are off without activation, checks canonical admission remains unregistered, generates an ephemeral test key, starts the four fixed loopback emulators, and executes only the new focused integration file. Its child environment excludes inherited provider credentials. It records each process exit and removes the private test key in `finally`.

Read `custody/issued-path-run.exit`, `supervisor-result.json`, `steps.json`, `family-issued-path-gates.json` and `issued-path-run.log` before interpreting a run. The detached starter's successful launch is not a test result. A cleanup readback must verify ports/processes are gone; preserve other workers.

## Interpretation limits

The positive policy, key and delivery identity are synthetic fixtures. A passing run establishes this proposal's emulator behavior. It does not establish canonical production approval, KMS custody or rotation, cross-project service IAM, automatic production outbox scheduling, owner-wide consent withdrawal, physical media deletion, hosted UI acceptance, independent review or release readiness.

The test explicitly invokes the dispatcher as its synthetic service actor. Withdrawal/deletion enforcement is demonstrated after the receiver acknowledges the event. The unchanged Storytime reader does not consult current canonical Privacy on every read: an undelivered withdrawal or deletion event is not a proven immediate denial. A reliable automatic transport and current-read revocation contract remain necessary before any real permission can be issued.

Withdrawal retains Storytime's story-wide epoch semantics and blocks regrant. Deletion removes only the enumerated family authority records after persisting a subject fence. Another owner's source story/chapter/state must remain intact when a recipient deletes their account. Source-media deletion and retained audit/tombstone policy remain separate work.

Historical #119 664-test, #118 29-scenario, #120 31-scenario and #335 20-test evidence is reused, not rerun or added to this focused suite's count.
