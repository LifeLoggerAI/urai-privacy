# Wave 1 Privacy Launch Lock Evidence

Domain: uraiprivacy.com

Repo: LifeLoggerAI/urai-privacy

Status: implementation evidence in progress

## Completed evidence

- Shared URAI foundation CSS added: `src/styles/urai-network-system.css`
- Shared attribution helper added: `src/lib/urai-attribution.js`
- Shared trust helper added: `src/lib/urai-trust.js`
- Shared form helper added: `src/lib/urai-form.js`
- URAI QA script added: `scripts/urai-qa-checks.js`
- QA wired into `preflight` through `npm run urai:qa`
- Global layout/navigation aligned with Wave 1 privacy routes
- Launch-safe trust language added to global footer and metadata

## Wave 1 public routes

- `/`
- `/privacy`
- `/privacy-center`
- `/passport`
- `/data-controls`
- `/consent`
- `/delete-export`
- `/responsible-ai`
- `/safety`
- `/what-urai-does-not-do`

## Privacy-center routes already present

- `/privacy-center/export`
- `/privacy-center/delete`
- `/privacy-center/consent`
- `/privacy-center/audit-log`
- `/privacy-center/retention`

## Launch-safe language coverage

The site now includes explicit public language around:

- Passport permissions
- data controls
- delete/export paths
- consent boundaries
- responsible AI
- safety boundaries
- no replacement for qualified human or professional support

## Protected/admin boundary

Admin and operational routes must remain protected and no-indexed before production launch.

Required protected routes include:

- `/admin`
- `/admin/privacy-requests`
- `/admin/audit-log`
- `/admin/policies`
- `/admin/retention`

## Evidence still required before approval

- Run `npm run preflight`
- Confirm `npm run urai:qa` passes after build output exists
- Confirm public pages include privacy links
- Confirm protected/admin routes are gated and no-indexed
- Confirm delete/export flow writes to the approved privacy backend
- Confirm DNS and SSL for `uraiprivacy.com`
- Confirm production deployment URL
- Record latest deploy commit
- Record owner approval

## Current launch decision

Do not mark approved until the preflight, deploy, DNS/SSL, form/backend, and protected-route checks are recorded.
