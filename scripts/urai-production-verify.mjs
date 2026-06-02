import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const hasPnpm = existsSync('pnpm-lock.yaml');
const hasPackage = existsSync('package.json');
const runner = hasPnpm ? 'pnpm' : 'npm';
const commands = [];

if (hasPackage) {
  commands.push([runner, ['run', 'typecheck', '--if-present']]);
  commands.push([runner, ['test', '--if-present']]);
  commands.push([runner, ['run', 'build', '--if-present']]);
  commands.push([runner, ['run', 'urai:qa', '--if-present']]);
}

let failed = false;
for (const [cmd, args] of commands) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) failed = true;
}

if (!commands.length) console.log('No package.json found; nothing to verify.');
process.exit(failed ? 1 : 0);
