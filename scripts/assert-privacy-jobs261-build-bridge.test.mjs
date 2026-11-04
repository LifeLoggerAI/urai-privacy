import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { EXACT_JOBS_SHA, EXACT_JOBS_TREE, PINNED_BLOBS } from './review-only/assert-privacy-jobs261-checkout.mjs';
import { JOBS261_EMULATOR_IMPORTS, captureJobs261GeneratedManifest } from './review-only/attest-jobs261-generated.mjs';
import { assertPrivacyJobs261BuildBridge, assertR562ReviewedPrivacyJobs261BuildBridge, R562_REVIEWED_JOBS261_TREE_SHA256, R562_REVIEWED_JOBS261_MANIFEST_SHA256, R562_REVIEWED_JOBS261_FILE_COUNT } from './review-only/assert-privacy-jobs261-build-bridge.mjs';

const root = mkdtempSync(join(tmpdir(), 'urai-r561-bridge-'));
for (const [i, relative] of JOBS261_EMULATOR_IMPORTS.entries()) {
  const file = join(root, 'functions/lib', relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `exports.ordinal = ${i};\n`);
}
const captured = captureJobs261GeneratedManifest(root);
const valid = Object.freeze({
  directory: root,
  declaredSha: EXACT_JOBS_SHA,
  generatedManifest: captured.manifest,
  expectedGeneratedDigest: captured.digest,
});
function gitMock(mutate = ({ output }) => output) {
  return (cmd, args) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args.slice(0, 2), ['-C', root]);
    const [action, ref, path] = args.slice(2);
    const output = action === 'rev-parse' ?
      (ref === '--show-toplevel' ? root :
        ref === '--abbrev-ref' && path === 'HEAD' ? 'HEAD' :
        ref === 'HEAD' ? EXACT_JOBS_SHA :
        ref === 'HEAD^{tree}' ? EXACT_JOBS_TREE : undefined) :
      action === 'hash-object' && ref === '--' ? PINNED_BLOBS[path] :
      action === 'status' ? '' : undefined;
    const mutated = mutate({ action, ref, path, output });
    return (mutated ?? '') + '\n';
  };
}
const check = (options = {}, mock = gitMock()) =>
  assertPrivacyJobs261BuildBridge({ ...valid, ...options }, mock);

test('R561: pinned checkout and four compiled imports both verified before use', () => {
  assert.equal(check(), true);
});
test('R561: no externally supplied digest is a hard stop', () => {
  assert.throws(() => check({ expectedGeneratedDigest: undefined }), /JOBS_GENERATED_BUILD_DIGEST_REQUIRED/);
  assert.throws(() => check({ generatedManifest: undefined }), /JOBS_GENERATED_BUILD_RECEIPT_REQUIRED/);
});
test('R561: source SHA mismatch denies before artifact verification', () => {
  assert.throws(() => check({ declaredSha: '0'.repeat(40) }), /JOBS_DECLARED_SHA_MISMATCH/);
});
test('R561: checked-out dirty tracked worktree denies despite green compiled digest', () => {
  const dirty = gitMock(({ action, output }) => action === 'status' ? ' M unrelated.ts' : output);
  assert.throws(() => check({}, dirty), /JOBS_TRACKED_WORKTREE_DIRTY/);
});
test('R561: wrong checkout tree is rejected', () => {
  const altered = gitMock(({ action, ref, output }) => action === 'rev-parse' && ref === 'HEAD^{tree}' ? '0'.repeat(40) : output);
  assert.throws(() => check({}, altered), /JOBS_ACTUAL_TREE_MISMATCH/);
});
test('R561: altered expected digest cannot be self-certified by source checkout', () => {
  assert.throws(() => check({ expectedGeneratedDigest: '0'.repeat(64) }), /ARTIFACT_MANIFEST_DIGEST_MISMATCH/);
});
test('R561: manifest with another module path rejected even with recalculated digest', () => {
  const altered = JSON.parse(captured.manifest);
  altered.files[0].path = 'functions/jobs/substitute.js';
  const forged = JSON.stringify(altered);
  const digest = createHash('sha256').update(forged).digest('hex');
  assert.throws(() => check({ generatedManifest: forged, expectedGeneratedDigest: digest }), /JOBS_COMPILED_ARTIFACT_DRIFT/);
});

const reviewed = (options = {}, mock = gitMock()) =>
  assertR562ReviewedPrivacyJobs261BuildBridge({ ...valid, ...options }, mock);

test('R565: independently reproduced exact Jobs build has immutable hard-coded acceptance pins', () => {
  assert.equal(R562_REVIEWED_JOBS261_TREE_SHA256,
    'd4add7024e9754b2a2938e8f58562cc0fd4870cd4d54d5a4c562a0fd12d037cd');
  assert.equal(R562_REVIEWED_JOBS261_MANIFEST_SHA256,
    '6fa8b9e6ea767c0d709be46d718ebcf29f3fdb5ad1bb7961669c0a12edba7a96');
  assert.equal(R562_REVIEWED_JOBS261_FILE_COUNT, 69);
});
test('R565: a self-issued synthetic manifest cannot authenticate its own digest', () => {
  assert.equal(check(), true, 'old R561 generic guard accepts synthetic fixture for unit test');
  assert.throws(() => reviewed(), /JOBS_INDEPENDENT_BUILD_DIGEST_MISMATCH/);
});
test('R565: even supplied reviewed digest cannot bless a different compiled tree', () => {
  assert.throws(() => reviewed({
    expectedGeneratedDigest: R562_REVIEWED_JOBS261_MANIFEST_SHA256,
  }), /JOBS_INDEPENDENT_BUILD_TREE_MISMATCH/);
});
test('R565: malformed or missing externally supplied receipt fails closed', () => {
  assert.throws(() => reviewed({
    generatedManifest: '{broken',
    expectedGeneratedDigest: R562_REVIEWED_JOBS261_MANIFEST_SHA256,
  }), /JOBS_INDEPENDENT_BUILD_MANIFEST_INVALID/);
  assert.throws(() => reviewed({
    generatedManifest: undefined,
    expectedGeneratedDigest: R562_REVIEWED_JOBS261_MANIFEST_SHA256,
  }), /JOBS_GENERATED_BUILD_RECEIPT_REQUIRED/);
});
test('R565: source identity checked before supplied compiled build pin', () => {
  assert.throws(() => reviewed({ declaredSha: '0'.repeat(40) }), /JOBS_DECLARED_SHA_MISMATCH/);
});
test('R565: original four-emulator fixture invokes reviewed pin before importing Jobs modules', () => {
  const source = readFileSync(new URL('../tests/integration/life-movie-jobs-rights-bridge.emulator.mjs', import.meta.url), 'utf8');
  const reviewedAt = source.indexOf('assertR562ReviewedPrivacyJobs261BuildBridge({');
  const jobsRequireAt = source.indexOf('const jobsRequire = createRequire(');
  assert.ok(reviewedAt > 0 && jobsRequireAt > reviewedAt,
    'strict reviewed build pin must execute before loading Jobs');
  assert.ok(!source.includes('assertPrivacyJobs261BuildBridge({'),
    'older generic caller-selected digest cannot be used in integration');
});

test('R561: post-build generated JS tampering denies despite intact Git tree', () => {
  const file = join(root, 'functions/lib', JOBS261_EMULATOR_IMPORTS[1]);
  appendFileSync(file, '// tampered\n');
  assert.throws(() => check(), /JOBS_COMPILED_ARTIFACT_DRIFT/);
});
test.after(() => rmSync(root, { recursive: true, force: true }));
