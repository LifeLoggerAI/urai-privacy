import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const candidates = ['app', 'lib', 'tests', 'scripts'];
const existing = candidates.filter((dir) => existsSync(dir));

if (existing.length === 0) {
  console.log('[lint-existing] No lintable directories found.');
  process.exit(0);
}

const result = spawnSync(
  'npx',
  ['eslint', ...existing, '--ext', '.ts,.tsx,.js,.mjs'],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      ESLINT_USE_FLAT_CONFIG: 'false'
    }
  }
);

process.exit(result.status ?? 1);
