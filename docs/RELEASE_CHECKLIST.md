# URAI Privacy Release Checklist

Status: **production blocked until complete**

This checklist defines the minimum release gate for `urai-privacy`.

## 1. Repository integrity

- [ ] Repository is on the intended release branch.
- [ ] Root lockfile is committed.
- [ ] Functions lockfile is committed.
- [ ] Local-only environment files and operational credentials are not committed.
- [ ] `README.md` accurately states the current readiness verdict.
- [ ] `docs/LOCK.md` has been updated with evidence.

## 2. Local deterministic verification

Run:

```bash
bash scripts/verify-release.sh
```

The script must complete these gates:

- [ ] Root deterministic install
- [ ] Functions deterministic install
- [ ] Lint
- [ ] Typecheck
- [ ] Unit tests
- [ ] Static Firebase rules validation
- [ ] Route smoke validation
- [ ] Tier-One privacy control-plane audit
- [ ] Next.js production build
- [ ] Functions build
- [ ] Functions typecheck
- [ ] Java runtime check
- [ ] Firebase emulator tests
- [ ] Security gate
- [ ] Production readiness assertions

## 3. Firebase emulator verification

- [ ] Java 17+ is installed.
- [ ] `npm run test:emulators` passes.
- [ ] Firestore rules prove owner-only reads/writes for user privacy records.
- [ ] Firestore rules prove non-admin denial for admin/server-only records.
- [ ] Firestore rules prove audit logs are immutable.
- [ ] Storage rules prove export files are private.
- [ ] Callable integration tests cover export request creation.
- [ ] Callable integration tests cover deletion request creation.
- [ ] Callable integration tests cover consent update.
- [ ] Callable integration tests cover admin denial for non-admins.

## 4. Security and dependency gate

- [ ] `npm run security:gate` passes.
- [ ] Critical production dependency vulnerabilities are zero or formally waived with mitigation.
- [ ] High vulnerabilities are reviewed and assigned remediation owners.
- [ ] No operational credential material is detected by the security gate.
- [ ] Firebase rules are deny-by-default.
- [ ] Storage rules are deny-by-default.
- [ ] Audit evidence cannot be modified or deleted by clients.

## 5. Privacy workflows

- [ ] Consent update writes `consentRecords`.
- [ ] Consent update appends `consentEvents`.
- [ ] Consent update writes audit evidence.
- [ ] Export request creates `privacyRequests` and `exportJobs`.
- [ ] Export processing writes private export JSON.
- [ ] Export processing writes private manifest JSON.
- [ ] Export manifest includes checksums and record count.
- [ ] Deletion request creates `deletionRequests`.
- [ ] Deletion processing creates a deletion plan and hash.
- [ ] Deletion destructive mode is explicitly authorized, idempotent, and audited before production use.
- [ ] Admin actions write audit/admin evidence.

## 6. User-facing Privacy Center

- [ ] `/privacy-center` renders for authenticated users.
- [ ] `/privacy-center/export` can create an export request.
- [ ] `/privacy-center/delete` can create a deletion request.
- [ ] `/privacy-center/consent` can update consent state.
- [ ] `/privacy-center/audit-log` shows only the current user's permitted audit history.
- [ ] `/privacy-center/retention` explains active retention behavior.
- [ ] Unauthenticated users are redirected or denied.
- [ ] Users cannot view another user's privacy records.

## 7. Admin console

- [ ] `/admin` routes require admin authorization.
- [ ] Non-admin users are denied by route guards and callable Functions.
- [ ] Admin request queues are live or clearly marked staging-only.
- [ ] Admin actions are recorded.
- [ ] Admin access to sensitive records is audited.
- [ ] Admin workflows include notes for sensitive/destructive operations.

## 8. Deployment evidence

### Staging

- [ ] Firebase staging project configured.
- [ ] Hosting deployed to staging.
- [ ] Functions deployed to staging.
- [ ] Firestore rules deployed to staging.
- [ ] Storage rules deployed to staging.
- [ ] Staging smoke test completed.
- [ ] Staging URLs recorded in `docs/LOCK.md`.

### Production

- [ ] Firebase production project configured.
- [ ] Hosting deployed to production.
- [ ] Functions deployed to production.
- [ ] Firestore rules deployed to production.
- [ ] Storage rules deployed to production.
- [ ] Production smoke test completed.
- [ ] Production URLs recorded in `docs/LOCK.md`.

## 9. Legal and governance approval

- [ ] Privacy policy reviewed by qualified counsel or designated legal reviewer.
- [ ] Terms/legal notices reviewed.
- [ ] Export workflow reviewed.
- [ ] Deletion workflow reviewed.
- [ ] Consent tiers reviewed.
- [ ] Data monetization/sharing language reviewed if applicable.
- [ ] Incident response owner approved.
- [ ] Signoff recorded in `docs/LOCK.md`.

## 10. Cross-repo adoption

- [ ] URAI core data collection mapped.
- [ ] URAI Admin access mapped.
- [ ] URAI Analytics consent/aggregation mapped.
- [ ] URAI Communications notification/SMS/email flows mapped.
- [ ] URAI Studio media/story asset flows mapped.
- [ ] URAI Spatial AR/VR/spatial data flows mapped.
- [ ] URAI Foundation research/public-good flows mapped.
- [ ] B2B Portal tenant/business data flows mapped.
- [ ] Asset Factory generated asset data flows mapped.
- [ ] Adoption evidence recorded in `docs/LOCK.md`.

## Release verdict rule

`urai-privacy` is **not production ready** until every required section above is complete or has an explicit, dated, owner-approved exception in `docs/LOCK.md`.
