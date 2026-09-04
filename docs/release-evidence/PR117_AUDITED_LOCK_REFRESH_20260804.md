# PR #117 audited lock refresh receipt

Date: 2026-08-04
Repository: `LifeLoggerAI/urai-privacy`
Branch: `reconstruct/privacy-current-main-20260804`
Parent authority: `a305920b860de281462f1856146e5c9f6e20a279`

## Committed lock authority

- Root `package-lock.json` Git blob: `b7aaf2027b122ed8ed4a3a1a81a938bfcb169299`
- Functions `package-lock.json` Git blob: `3c052665495b5fb50f0597f351068be645a48837`
- Root candidate SHA-256: `6fb9eeb06c349cda70930db9e711a46c68450edebd0b462a3b8310c44233fdef`
- Functions candidate SHA-256: `a606f6b3e9dcf125c69fc4f6a0271ac181899d531e282c2094cbd274be038380`

Both dependency graphs were regenerated under the retained remediation policy and audited at zero known vulnerabilities before publication.

## Restored release contracts

- `test:export:contract`
- `test:deletion:contract`
- Firebase CLI authority `15.24.0`
- Emulator configuration authority `firebase.emulators.json`
- Authenticated live proof identity binding requires both the expected Firebase project and exact checked-out commit SHA.

## Writer disposition

The bounded one-time writer removed itself in the published successor tree. It is not a permanent workflow authority.

## Boundary

This receipt establishes source and dependency evidence only. It does not establish protected Firebase deployment, authenticated live consent/export/deletion execution, legal/privacy approval, independent privacy/security approval, or production certification.
