# Privacy dependency audit — 2026-07-14

## Exact diagnostic identity

- Repository: `LifeLoggerAI/urai-privacy`
- Branch: `reconcile/deletion-orchestration-into-82-20260714`
- Audited head: `78fbd6595dc1351394db4d53885e2f5808820eef`
- Workflow run: `29379032479`
- Artifact: `8328951084`
- Artifact digest: `sha256:7566fbdf42ee8076c9192f91bd2731f974e4855cbaa21816c5fd2c40c3847d10`

## Results

`npm ci --ignore-scripts` and `npm audit --json` were executed independently for the root package graph and the Functions package graph.

- Root: 0 low, 0 moderate, 0 high, 0 critical vulnerabilities.
- Functions: 0 low, 0 moderate, 0 high, 0 critical vulnerabilities.
- Root audit exit: 0.
- Functions audit exit: 0.

This supersedes the earlier retained install evidence that reported unresolved dependency findings. The audit is source-only and does not certify live privacy operations, deployment, legal approval, protected staging, recovery, or rollback.

No deployment, provider call, credential mutation, billing action, destructive deletion, user-data mutation, or production-data mutation occurred.
