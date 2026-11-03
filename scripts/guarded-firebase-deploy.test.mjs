import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cmd = resolve(root, 'scripts/guarded-firebase-deploy.mjs');
function run(args, extraEnv = {}) {
  return spawnSync(process.execPath, [cmd, ...args], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, URAI_PRIVACY_APPROVED_FIREBASE_PROJECT: '', URAI_PRIVACY_APPROVED_COMMIT_SHA: '', ...extraEnv },
    timeout: 5000
  });
}

test('rejects unscoped implicit project deploy', () => {
  const result = run([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /explicit valid Firebase project ID/);
});
test('rejects missing project value', () => {
  const result = run(['--project']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /missing project ID/);
});
test('rejects explicit Firestore or Storage deployment scope injection', () => {
  for (const scope of ['firestore', 'storage', 'hosting', 'functions']) {
    const result = run(['--project', 'urai-staging', '--only', scope]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unsupported argument/);
  }
});
test('rejects arbitrary deployment flags even after a valid project', () => {
  for (const flag of ['--force', '--except', '--debug', '--interactive']) {
    const result = run(['--project', 'urai-staging', flag]);
    assert.equal(result.status, 2);
  }
});
test('rejects argument injection in project ID', () => {
  for (const bad of ['--force', 'urai-staging;echo', 'https://staging', 'urai-staging/other', 'UrAi']) {
    const result = run(['--project', bad, '--dry-run']);
    assert.equal(result.status, 2);
  }
});
test('dry-run prints scoped functions-only command without contacting Firebase', () => {
  const result = run(['--project', 'urai-staging', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN; no provider call/);
  assert.match(result.stdout, /firebase deploy --only functions:privacy --project urai-staging --non-interactive/);
  assert.doesNotMatch(result.stdout, /--only firestore|--only storage|--only hosting/);
});
test('real deploy refuses target project without explicit approval', () => {
  const result = run(['--project', 'urai-staging']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not match/);
});
test('real deploy refuses absent or malformed SHA even when project is approved', () => {
  const result = run(['--project', 'urai-staging'], {
    URAI_PRIVACY_APPROVED_FIREBASE_PROJECT: 'urai-staging',
    URAI_PRIVACY_APPROVED_COMMIT_SHA: 'NOT_REVIEWED'
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /exact approved source commit SHA/);
});
test('real deploy refuses an unrelated valid commit SHA', () => {
  const result = run(['--project', 'urai-staging'], {
    URAI_PRIVACY_APPROVED_FIREBASE_PROJECT: 'urai-staging',
    URAI_PRIVACY_APPROVED_COMMIT_SHA: 'a'.repeat(40)
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /checkout HEAD does not match/);
});
test('deployment fails if expected privacy codebase disappears from firebase.json', () => {
  const configFile = resolve(root, 'firebase.json');
  const original = readFileSync(configFile, 'utf8');
  try {
    const config = JSON.parse(original);
    config.functions = [{ codebase: 'other', source: 'functions' }];
    writeFileSync(configFile, JSON.stringify(config));
    const result = run(['--project', 'urai-staging', '--dry-run']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /expected privacy Functions codebase/);
  } finally {
    writeFileSync(configFile, original);
  }
});
