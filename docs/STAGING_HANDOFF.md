# URAI Privacy Staging Handoff

Last updated: 2026-05-10

## Current status

`urai-privacy` is a staging candidate, not a production release.

The local `feat/privacy` branch has demonstrated:

- `npm run build` can complete.
- `npm run dev` can serve `/` and core routes locally.
- duplicate/stale Firebase compatibility files can break module resolution and must not be committed.
- stale sitemap duplicates can break dev routing.
- TypeScript and ESLint bypasses are still a release blocker until removed.

## What must happen before staging deploy

1. Push the local `feat/privacy` branch to GitHub.
2. Open a PR from `feat/privacy` into `main`.
3. Confirm these local cleanup commits are included:
   - remove `firebase/firebase.js`
   - remove duplicate `app/sitemap.xml/route.ts`
   - keep `firebase/firebase.ts` with `firebaseApp`, `app`, `auth`, `db`, `firestore`, `functions`, and `storage` exports
   - keep `firebase/index.ts` as a re-export barrel
   - remove generated artifacts such as `._backup_deps/` and `tsconfig.tsbuildinfo`
   - remove active `pnpm` dependency from npm app runtime paths
4. Run:

```bash
rm -rf .next
npm install
npm run build
npm run dev
```

5. Confirm the dev server has no hard runtime errors and these routes return 200 locally:

- `/`
- `/privacy`
- `/privacy-center`
- `/portal`
- `/admin`
- `/consent`
- `/policies`
- `/transparency`
- `/data-rights`
- `/terms`
- `/cookies`

## What must happen before production deploy

Production release is blocked until all of these pass:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run test:e2e
npm run security:gate
bash scripts/assert-production-ready.sh
npm run build
```

Firebase checks required before production:

```bash
firebase emulators:start
npm run test:emulators
firebase deploy --only hosting,functions,firestore,storage
```

## Hard production blockers

- `next.config.mjs` must not contain `ignoreBuildErrors: true`.
- `next.config.mjs` must not contain `ignoreDuringBuilds: true`.
- Real Firebase staging/production project IDs must be configured outside public committed secrets.
- Authenticated user flows must be tested end-to-end.
- Admin routes must verify role/claim enforcement.
- Firestore and Storage rules must be tested with emulator allow/deny tests.
- Export, deletion, consent, audit, and retention workflows must be tested against Firebase emulators.
- Legal/privacy templates must receive qualified legal review before public user launch.
- A release lock must record commit SHA, deploy target, verification results, staging URL, production URL, and approver.

## Verdict language

Allowed now:

- `local build passing`
- `local dev running`
- `staging candidate after branch push/PR`

Not allowed yet:

- `production ready`
- `deployed for users`
- `fully wired into system of systems`
- `legally reviewed`
- `100% complete`
