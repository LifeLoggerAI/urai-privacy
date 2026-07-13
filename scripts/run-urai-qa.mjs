import { spawnSync } from 'node:child_process';

const checks = [
  ['Static rules validation', ['run', 'test:rules:static']],
  ['Route and protected-surface smoke', ['run', 'test:e2e']],
  ['Cross-repository privacy adoption audit', ['run', 'audit:privacy']],
  ['Tier-One privacy contract audit', ['run', 'audit:tier-one']],
  ['Security boundary gate', ['run', 'security:gate']],
];

let failed = 0;
for (const [label, args] of checks) {
  console.log(`\n[urai-privacy-qa] ${label}`);
  const result = spawnSync('npm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, URAI_PRIVACY_QA: '1' },
  });
  if (result.error) {
    console.error(`[urai-privacy-qa] ${label} could not start: ${result.error.message}`);
    failed += 1;
    continue;
  }
  if (result.status !== 0) {
    console.error(`[urai-privacy-qa] ${label} failed with status ${result.status}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`[urai-privacy-qa] FAIL: ${failed} required QA check(s) failed.`);
  process.exit(1);
}

console.log('\n[urai-privacy-qa] PASS: rules, routes, adoption, Tier-One, and security checks passed.');
