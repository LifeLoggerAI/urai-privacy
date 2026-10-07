# Privacy complete dependency repair

Date: 2026-10-07
Owner base: `9f8cfec471ef15a1b0dec02545626f92347b51e0` (PR #160)
Status: implemented and locally verified source; current native CI, independent review and governed deployment remain required.

The immutable owner root lock had 50 advisory findings: three critical, 24 high, 22 moderate and one low. Its separate Functions lock had zero findings. This repair updates the root CLI to 15.32.1, the test runner to Vitest 5.0.3 with Vite 8.3.3, compatible Node 22 types and supported transitive fixes. It keeps the current application framework, React 18, canonical consent/export/deletion source and the separate zero-finding Functions package/lock unchanged. Runtime engines, nvm/Nix guidance and current CI use compatible Node 22. The removed `minWorkers` option is obsolete in the new runner; tests retain fork isolation and the explicit single-worker maximum for emulator runs.

Braces uses the existing licensed `3.0.3-urai.1` guard source from `urai-admin@85df257cf1bc382e5abb455900abd146b21c4c0b`. All 12 source/license/provenance blobs were copied and verified exactly. This is a maintained local mitigation, not a claim that the published upstream advisory disappeared or that independent security review was obtained. `.npmrc` packs the portable local file dependency during frozen installation; it prevents broken consumer-relative links. CLI 15.32.1 uses repaired upstream stream-json 3.7.0 through its actual ESM loader; no incompatible 1.x stream-json override is introduced. Legacy brace-expansion and form-data consumers retain compatible patched major versions.

The existing exact-head dependency workflow now audits the complete root and Functions graphs, including development tools, and fails on any invalid or nonzero low/moderate/high/critical count. Its required job identity and read-only permissions remain unchanged. Installed consumer behavior is required after frozen installation. No audit finding is suppressed and no lock is rewritten by CI.

## Executed local proof

- Complete repaired root lock: 1,235 entries; full npm audit zero at every severity; frozen `npm ci --dry-run` consistency passes without force or peer bypass. This check is a dry run, not a complete installed frontend graph.
- An isolated frozen 853-record CLI/Vitest/Firebase graph installed 830 applicable packages. Missing fast-glob consumer packages were subsequently installed from the exact full-root lock using verified registry tarball SHA-512 integrity. Full root frontend installation/build is a separate gate.
- Actual upgraded runner: 268 retained unit/integration contract cases pass, with no test assertion or canonical handler change. Strict Functions build and the ordinary root TypeScript check pass. Root TypeScript uses exact locked Next 16.3.6 declarations plus locked React 18 types; this does not establish framework runtime/build acceptance.
- Eleven installed consumer/security cases pass: actual CLI watcher and Next ESLint fast-glob/micromatch guard fork, ordinary globs/ranges, hostile string and direct-AST refusal, actual CLI ESM stream import/JSON assembly/prototype safety/depth refusal, CSV and FTP compatibility. Seven matching refusal regressions fail against integrity-verified unchanged published braces 3.0.3.
- Complete export/deletion contracts and static rules checks pass.
- Actual Java 21, Auth, Firestore and Storage emulator run on this remediated graph executes all 16 current rule cases: 15 pass and the one real-callable withdrawal case fails because Functions is unavailable. The suite retains exit 1; no assertion is skipped or weakened.

## Remaining runtime boundary

The mandatory loaded Functions proof actually failed with `listen EPERM` for its AF_UNIX worker socket in this execution environment. A socket-capable authorized runner must execute the unchanged mandatory loaded-callable/consent-withdrawal harness and exact successor native matrix. Compile, mocks, independent rules or source admission do not establish loaded Functions, protected cloud runtime, provider availability, production deletion/export, independent release approval or Golden Master. Existing previously issued Storage credentials retain their natural expiry/object-removal transition, and already emitted private bytes cannot be recalled.

Source admission must preserve the current sole owner and rerun evidence for its successor SHA. No main merge, Firebase deployment, provider call, billing action, legal title or release approval occurs in this repair.
