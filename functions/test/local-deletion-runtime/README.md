# Local deletion callable acceptance

This fixture exposes the actual guarded production entry points to emulators
only. Do not deploy the fixture. From the Privacy root with the sibling Spatial
SDK/CLI installation available:

```powershell
npm --prefix functions run build
$env:NODE_PATH = (Resolve-Path ../urai-spatial/node_modules).Path
node ../urai-spatial/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,storage,functions --project demo-urai-local-deletion --config firebase.local-deletion-review.json "node tests/integration/local-deletion-lifecycle.emulator.cjs"
```

The runner rejects hosted credentials and requires the exact demo project and
loopback Auth/Firestore/Storage ports. Firebase Auth issues the owner and admin
tokens. Actual HTTP callables perform dry-run and execution; no manual completion
state is seeded. Before the repair, the stale lease inventory assertion failed.

Cases cover ordinary owner denial, stale export lease planning/deletion, zero
local residuals still blocked by downstream acknowledgments, Auth removal,
active export lease preservation, legal hold introduced after dry-run, and
orphan descendants preventing local verification. Global completion remains
false. The late-hold case is between dry-run and execution, not a proof of atomic
legal-hold enforcement during every destructive write. This is local synthetic
acceptance, not hosted/provider acceptance or independent approval.
All eight checks also passed in a subsequent Node 22 emulator run, matching the
Functions engine declaration. Hosted/provider verification remains separate.

