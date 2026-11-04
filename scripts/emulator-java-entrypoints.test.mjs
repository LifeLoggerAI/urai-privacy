/** R543: native, credential-free JDK 21 fail-fast emulator entrypoint tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const JAVA_CHECK = fileURLToPath(new URL('./check-java.mjs', import.meta.url));
const ENTRYPOINTS = [
  'test:emulators',
  'test:life-movie:review:firestore:emulated',
  'test:life-movie:jobs-rights:bridge:emulated',
  'test:life-movie:negative:emulated',
];
const source = () => JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

test('R543: every repository emulator entrypoint checks Java before executing Firebase', () => {
  const scripts = source().scripts;
  for (const key of ENTRYPOINTS) {
    const command = scripts[key];
    assert.equal(typeof command, 'string', key + ' missing');
    assert.match(command, /^npm run check:java && /, key + ' must fail fast on Java <21');
    assert.match(command, /firebase emulators:exec --config firebase\.emulators\.json/);
    assert.match(command, /--project urai-privacy-integration-test/);
  }
});

test('R543: the maintained unit suite enrolls this guard', () => {
  assert.match(source().scripts['test:unit'], /^node --test scripts\/emulator-java-entrypoints\.test\.mjs && npm run test:jobs-checkout:attestation && npm run test:jobs-compiled:attestation && vitest run tests\/unit$/);
  assert.equal(source().scripts['test:jobs-checkout:attestation'], 'node --test scripts/assert-privacy-jobs261-checkout.test.mjs');
  assert.equal(source().scripts['test:jobs-compiled:attestation'], 'node --test scripts/attest-jobs261-generated.test.mjs scripts/assert-privacy-jobs261-build-bridge.test.mjs');
});

test('R543: CLI and protected workflow both require JDK 21', () => {
  const code = readFileSync(JAVA_CHECK, 'utf8');
  const workflow = readFileSync(join(ROOT, '.github/workflows/privacy-release-verification.yml'), 'utf8');
  assert.match(code, /const minimumMajor = 21;/);
  assert.match(workflow, /java-version:\s*["']21["']/);
});

function withMockJava(version) {
  const dir = mkdtempSync(join(tmpdir(), 'urai-r543-jdk-'));
  try {
    if (version !== null) {
      const path = join(dir, 'java');
      writeFileSync(path, '#!/bin/sh\n' +
        'echo ' + String.fromCharCode(39) + 'openjdk version "' + version + '"' + String.fromCharCode(39) + ' >&2\n');
      chmodSync(path, 0o755);
    }
    return spawnSync(process.execPath, [JAVA_CHECK], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, PATH: dir + (version === null ? '' : delimiter + (process.env.PATH || '')) },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('R543: Java 17 is rejected before emulator work', { skip: process.platform === 'win32' }, () => {
  const r = withMockJava('17.0.12');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /required emulator minimum 21/);
});

test('R543: Java 21 is accepted', { skip: process.platform === 'win32' }, () => {
  const r = withMockJava('21.0.12');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK: Java 21/);
});

test('R543: missing Java fails closed', { skip: process.platform === 'win32' }, () => {
  const r = withMockJava(null);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /Java runtime not found/);
});
