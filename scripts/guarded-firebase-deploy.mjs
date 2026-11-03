#!/usr/bin/env node
/**
 * Privacy functions-only Firebase deployment boundary.
 * Avoids accidentally replacing Spatial-owned Firestore/Storage rules.
 * This guard is NOT independent release approval or a hosted proof.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const deny = (message) => {
  console.error(`[privacy-deploy-boundary] DENIED: ${message}`);
  process.exit(2);
};

let project = '';
let dryRun = false;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--project' && !project) {
    const next = args[++index];
    if (!next || next.startsWith('-')) deny('missing project ID after --project');
    project = next;
  } else if (arg === '--dry-run' && !dryRun) {
    dryRun = true;
  } else {
    deny(`unsupported argument ${JSON.stringify(arg)}; only --project ID and --dry-run are allowed`);
  }
}

if (!/^[a-z][a-z0-9-]{4,29}$/.test(project) || project.endsWith('-')) {
  deny('an explicit valid Firebase project ID is required; do not rely on .firebaserc defaults');
}

let firebaseConfig;
try {
  firebaseConfig = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
} catch {
  deny('cannot inspect the pinned firebase.json configuration');
}
const codebases = Array.isArray(firebaseConfig.functions)
  ? firebaseConfig.functions
  : [firebaseConfig.functions];
if (!codebases.some((item) => item?.codebase === 'privacy' && item?.source === 'functions')) {
  deny('firebase.json does not declare exactly the expected privacy Functions codebase/source');
}

// NEVER pass through caller-provided --only/--except/--force flags.
// Explicitly excludes hosting, Firestore, Storage and any other Functions codebase.
const safeArgs = ['deploy', '--only', 'functions:privacy', '--project', project, '--non-interactive'];
if (dryRun) {
  console.log(`[privacy-deploy-boundary] DRY RUN; no provider call: firebase ${safeArgs.join(' ')}`);
  process.exit(0);
}

// Procedural constraints only. Independent nonauthor review, approved IAM,
// staging/rollback evidence and production GO must be verified separately.
if (process.env.URAI_PRIVACY_APPROVED_FIREBASE_PROJECT !== project) {
  deny('target project does not match URAI_PRIVACY_APPROVED_FIREBASE_PROJECT');
}
const approvedSha = process.env.URAI_PRIVACY_APPROVED_COMMIT_SHA ?? '';
if (!/^[a-f0-9]{40}$/.test(approvedSha)) {
  deny('the exact approved source commit SHA is required');
}
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
if (head.status !== 0 || head.stdout.trim() !== approvedSha) {
  deny('checkout HEAD does not match the explicitly approved source SHA');
}
const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', shell: false });
if (status.status !== 0 || status.stdout.trim() !== '') {
  deny('source checkout must be clean before deployment');
}

const result = spawnSync('firebase', safeArgs, { cwd: root, stdio: 'inherit', shell: false });
if (result.error) deny(`Firebase CLI could not start: ${result.error.message}`);
process.exit(result.status ?? 1);
