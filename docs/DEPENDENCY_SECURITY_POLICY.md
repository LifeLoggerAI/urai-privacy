# Dependency Security Policy

`npm run verify:release` currently records dependency audit findings but does not automatically apply breaking upgrades. This is intentional: the current audit remediation path includes major framework/runtime changes that must be tested as a migration, not applied blindly during release hardening.

## Current known dependency risk classes

- Next.js advisories requiring a breaking upgrade path.
- Firebase Web SDK / `undici` advisories requiring a Firebase SDK migration.
- Firebase Admin / Functions transitive advisories requiring functions runtime dependency migration.

## Policy

1. Critical vulnerabilities in runtime dependencies must block production deploy unless explicitly accepted by the release owner.
2. High vulnerabilities must be triaged before production deploy and either fixed or documented as an accepted risk with mitigation.
3. `npm audit fix --force` must not be run directly on the release branch without a migration branch, because it may move Next.js, Firebase, and functions dependencies across breaking boundaries.
4. Dependency migrations must preserve:
   - `npm run typecheck`
   - `npm run test:unit`
   - `npm run test:integration`
   - `npm run test:emulators`
   - `npm run build`
   - `npm run security:gate`
   - `npm run verify:release`

## Recommended migration order

1. Create `dependency-modernization` branch.
2. Upgrade Next.js and React ecosystem packages first.
3. Upgrade Firebase Web SDK and verify client auth/firestore/storage/functions calls.
4. Upgrade `firebase-functions` and `firebase-admin` in `functions/`.
5. Rebuild lockfiles with `npm install` and `npm --prefix functions install`.
6. Run full release verification.
7. Deploy to staging only after green verification.
8. Run smoke tests and capture evidence.

## Current deploy posture

The repo can be release-verified, but long-term production hardening remains YELLOW until dependency advisories are either resolved or formally accepted by the release owner.
