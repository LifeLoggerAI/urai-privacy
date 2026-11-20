# R1064 — exact-source Privacy native denial compatibility against Jobs #448 (GENESIS HOLD)

Immutable parent Privacy #274: `d36189c8c93ace65b05688064cb240b832050019`, with all original history, tests and donor branches preserved. Jobs dependency advanced from #443 `bbe3ef6f8807a42c0a402ade8a5d5ebd43f4c0aa` to the final two-parent Jobs #448 R1063B candidate `2ead65f9d6e109a057c0b322f0755a8b9a271b8a`. The three existing native/CI files have four consistent exact-source Jobs SHA pin replacements, plus review-only workflow branch eligibility. NO Privacy production authorization, signed positive grant, IAM grant, private-media write or user data was modified.

## Required source-pinned acceptance

- Clean detached Jobs `2ead65f9d6e109a057c0b322f0755a8b9a271b8a` and Privacy `<exact commit for this branch>` checkouts, verified by git.
- Credential-free Node22/pnpm8.15.9/Java21, disposable Firebase Auth/Firestore/Functions/Storage native negative boundary via `scripts/run-r30-native-jobs-privacy-acceptance.sh`.
- Preserve earlier actual Jobs #448 machine receipt: 56/56 focused, full verify exit 0, typecheck exit 0, Functions build exit 0, 28/28 original Firestore/Storage emulator tests. That receipt does **not** inherit cross-service acceptance for this new Privacy SHA.
- Native test success must explicitly show `positiveGrant=false render=false`; it cannot prove positive owner-signed C6 consent or real protected Replay.
- If bootstrap cannot provision or GitHub Actions remains startup-failed, preserve exact stdout/stderr and classify as BLOCKED, not PASS.

## Residual P0 / stop conditions

Jobs #252: exclusive live GCS IAM trusted broker with worker identity denied, durable epoch/write reservation and stream drain, exact Storage generations, physical post-ACK write 403 and deletion ACK. Labs #370: Runpod affected key revocation and security containment receipt. Protected GitHub CI and independent review. Authentic owner consent→Privacy→Studio→Jobs→private Replay→withdrawal→downstream purge; device/visual/accessibility/rollback and founder release GO. **All remain open. Production output writes stay hard-disabled. No IAM changes, deployment or mainline merge.**
