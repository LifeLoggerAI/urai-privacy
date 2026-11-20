# R1212 — Privacy #304 to Jobs #497 exact-source security lock integration (HOLD)

Date: 2026-11-12 / 2026-11-13 UTC. Review-only, not production authorization.

Privacy parent: 3b46faad91774abc7b17f4cacf9b3ae81bd97398; Jobs parent: dea3228d4ca4e05172c49df26ce916b8d520b191; new Jobs #497: e610a3c332968951f92fcf2a92c8d4cc16ec7a74.

This integrates the exact tested dependency-remediation commit as the **sole** Jobs source for the existing original R30 four-emulator negative-denial suite. Updated only two workflow SHA references, shell runner pin, emulator fixture pin, workflow title and one exact reviewer branch allowlist. Privacy consent/runtime semantics are not modified. Production writes remain DISABLED and release HOLD_NO_GO.

Existing exact-source Jobs #497 evidence: frozen install PASS, full original Jobs verifier EXIT 0, workspace build EXIT 0, audit C0/H81/M69/L22 and EXIT 1 (not a clean audit). Independent native re-test of *this new Privacy HEAD* is REQUIRED, with four emulators, exact Jobs source, original process exit, hash, and logs. GitHub protected CI still fails before steps. Live GCS IAM, upload draining, generation deletion, owner-positive C6 lifecycle, Runpod incident, external reviews and founder approval remain blocked.

Do not merge or deploy from source-level emulator results alone.
