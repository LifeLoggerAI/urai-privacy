import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const hasPnpm = existsSync('pnpm-lock.yaml');
const hasPackage = existsSync('package.json');
const runner = hasPnpm ? 'pnpm' : 'npm';
const commands = [];

if (hasPackage) {
  // Root typechecks/tests import Functions sources; match standalone CI setup.
  if (existsSync('functions/package.json')) {
    commands.push(['npm', ['ci', '--prefix', 'functions']]);
  }
  // pnpm forwards options after a script name to the script itself.
  // Handle optional scripts on the package-manager side for both runners.
  for (const script of ['typecheck', 'test', 'build', 'urai:qa']) {
    commands.push([runner, ['run', '--if-present', script]]);
  }
}

let failed = false;
for (const [cmd, args] of commands) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) failed = true;
}

if (!commands.length) console.log('No package.json found; nothing to verify.');
process.exit(failed ? 1 : 0);
