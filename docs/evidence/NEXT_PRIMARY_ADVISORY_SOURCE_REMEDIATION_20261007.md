# Next maintenance source remediation — 2026-10-07

This bounded component donor is based on exact owner 6e924f765dba68b1c5ae768c74df0df7e066a2c6. It patches the active Next source/lock to 16.3.8 for GHSA-4jqv-mc3x-m676 and GHSA-mcj8-r9mp-w47p, whose primary GitHub advisory JSON was freshly read at advisory-database commit bd4903bcb0086eb4b511a155cd54179818bbefe3. Both identify fixed versions 15.5.27 and 16.3.8.

The existing1235-record root lock changes only12 Next/env/ESLint/platform records. Every unrelated lock record, existing file-based braces mitigation and all overrides are unchanged. Actual `npm ci --dry-run --offline --ignore-scripts --no-audit --no-fund --install-links` passed on Node22.23.3/npm11.9.0 without changing the lock or creating node_modules. Functions source/lock, export/deletion authority and fail-closed local-fork risk acceptance are unchanged.

Verification used individual public npm version GETs and local source/lock analysis. Every changed Next package SRI, tarball, dependency/optional/peer metadata, platform and engine constraint matches the official version metadata. Existing mitigations and unrelated package configuration remain unchanged. The fixed version is outside these two published affected ranges; this is not a complete current vulnerability certification.

No repository graph audit was performed for this successor. An automatic review rejected the earlier local graph-audit transmission; that action remains stopped. These source changes remediate independently proven vulnerabilities and do not seek the rejected evidence through dispatch or publication. Existing installed dependency, risk acceptance, independent review and production gates retain their authority.

Fresh native exact-head checks, actual installed full-graph consumers, frontend build/device/browser proof and deployed source parity remain separate requirements. Predecessor audit or approval does not transfer. Verdict: BLOCKED for release acceptance. No main merge, deployment, legal representation, real provider call, paid execution or self-approval is authorized by this source admission.
