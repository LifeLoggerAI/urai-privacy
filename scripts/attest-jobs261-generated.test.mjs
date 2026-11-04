import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { JOBS261_EMULATOR_IMPORTS, captureJobs261GeneratedManifest, assertJobs261GeneratedManifest } from './review-only/attest-jobs261-generated.mjs';

const root = mkdtempSync(join(tmpdir(), 'urai-r560-'));
for (const [i, relative] of JOBS261_EMULATOR_IMPORTS.entries()) {
  const path = join(root, 'functions', 'lib', relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'module.exports = ' + (i + 1) + ';\n');
}
const captured = captureJobs261GeneratedManifest(root);
const check = (override = {}) => assertJobs261GeneratedManifest({ directory: root, ...captured, ...override });

test('R560: four exact generated imports match separately captured manifest', () => {
  assert.equal(check(), true);
  assert.equal(JSON.parse(captured.manifest).files.length, 4);
});
test('R560: missing expected out-of-band manifest digest fails closed', () => {
  assert.throws(() => check({ digest: undefined }), /ARTIFACT_EXPECTED_DIGEST_REQUIRED/);
});
test('R560: changed manifest body fails its digest', () => {
  assert.throws(() => check({ manifest: captured.manifest + ' ' }), /ARTIFACT_MANIFEST_DIGEST_MISMATCH/);
});
test('R560: mutated generated JS fails even though source checkout could be unchanged', () => {
  const file = join(root, 'functions/lib', JOBS261_EMULATOR_IMPORTS[0]);
  appendFileSync(file, '\n// altered after frozen build\n');
  assert.throws(() => check(), /JOBS_COMPILED_ARTIFACT_DRIFT/);
});
test('R560: changed manifest filename cannot redirect verification', () => {
  const obj = JSON.parse(captured.manifest);
  obj.files[0].path = 'functions/jobs/other.js';
  const altered = JSON.stringify(obj);
  const alteredDigest = createHash('sha256').update(altered).digest('hex');
  assert.throws(() => check({ manifest: altered, digest: alteredDigest }), /JOBS_COMPILED_ARTIFACT_DRIFT/);
});
test('R560: only disposable absolute roots are accepted', () => {
  assert.throws(() => check({ directory: '/' }));
  assert.throws(() => check({ directory: 'relative' }));
});
test.after(() => rmSync(root, { recursive: true, force: true }));
