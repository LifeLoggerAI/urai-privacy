# Jacob Operations Package — URAI Privacy

Jacob owns production readiness execution and operational bottleneck removal for `LifeLoggerAI/urai-privacy`.

## Daily responsibilities

- Run and archive `npm run verify:release` output.
- Confirm Firebase project and hosting target before deploy.
- Validate environment variables against `.env.example`.
- Track lint, typecheck, build, unit, rules, emulator, smoke, and security gate status.
- Confirm Firestore and Storage rules are tested before deploy.
- Confirm auth, owner isolation, admin access, export, deletion, consent, retention, and audit-log scenarios.
- Maintain release notes and blocker log.
- Escalate founder-only decisions and production credentials gaps.

## Daily report format

```text
Date:
Repo: LifeLoggerAI/urai-privacy
Branch:
Firebase project:
Hosting target:
Deployment status:
CI status:
Lint status:
Typecheck status:
Build status:
Unit test status:
Integration test status:
E2E status:
Smoke test status:
Security rules status:
Env/secrets status:
Open blockers:
Evidence links:
Next actions:
Escalation needed:
Final status: RED / YELLOW / GREEN
```

## Production deployment gate

Do not deploy production unless all are true:

1. Correct Firebase project is verified by the deploy operator.
2. Correct hosting target is verified by the deploy operator.
3. Environment variables are configured in hosting and match `.env.example`.
4. `npm run verify:release` passes from a clean checkout.
5. Staging smoke tests pass.
6. Rollback commit and deploy command are documented.
7. Production deploy is explicitly authorized.

## Evidence required

- Git SHA deployed.
- Full verifier output.
- Firebase project ID.
- Hosting target.
- Smoke-test result list.
- Rollback SHA.
- Any known audit warnings or accepted risks.
