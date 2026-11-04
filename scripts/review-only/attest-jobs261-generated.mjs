/**
 * R561 review-only frozen Jobs #261 generated artifact attestation.
 * The expected manifest/digest MUST come from a separately preserved build
 * receipt. A test runner may not compute and trust its own expected hash.
 * This guards generated files (including transitive imports) between a frozen
 * build and use; it does not attest compiler supply chain, production IAM,
 * signed workload identity, C6 rights, customer data or release permission.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';

export const JOBS261_EMULATOR_IMPORTS = Object.freeze([
  'functions/jobs/studioLifeMovieContract.js',
  'functions/privacy/lifeMovieFirebaseOwnerState.js',
  'functions/privacy/lifeMovieFirebaseSourceRightsAdapter.js',
  'functions/privacy/lifeMovieDerivativeRevocation.js',
]);
const DIGEST = /^[0-9a-f]{64}$/;
const SIZE_LIMIT = 10_000_000;
const TOTAL_LIMIT = 80_000_000;
const FILE_LIMIT = 5000;
const DEPTH_LIMIT = 32;
const MANIFEST_VERSION = 'urai-jobs261-generated-tree-review-v2';
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function checkedRoot(directory) {
  assert.ok(typeof directory === 'string' && isAbsolute(directory), 'ARTIFACT_ABSOLUTE_ROOT_REQUIRED');
  const actual = realpathSync(directory);
  assert.ok(actual.startsWith('/tmp' + sep) && actual.length > 5, 'ARTIFACT_DISPOSABLE_ROOT_REQUIRED');
  return actual;
}
function compiledInventory(directory) {
  const root = checkedRoot(directory);
  const lib = join(root, 'functions', 'lib');
  const statLib = lstatSync(lib);
  assert.ok(statLib.isDirectory() && !statLib.isSymbolicLink(), 'ARTIFACT_LIB_DIRECTORY_INVALID');
  assert.equal(realpathSync(lib), lib, 'ARTIFACT_LIB_SYMLINK_DENIED');
  const all = [];
  let totalBytes = 0;
  function walk(dir, relative, depth) {
    assert.ok(depth <= DEPTH_LIMIT, 'ARTIFACT_DIRECTORY_DEPTH_EXCEEDED');
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      assert.match(entry.name, /^[a-zA-Z0-9._-]+$/, 'ARTIFACT_PATH_INVALID');
      assert.notEqual(entry.name, '..', 'ARTIFACT_PATH_INVALID');
      const path = relative ? relative + '/' + entry.name : entry.name;
      const abs = join(dir, entry.name);
      const stat = lstatSync(abs);
      assert.ok(!stat.isSymbolicLink(), 'ARTIFACT_SYMLINK_DENIED');
      assert.equal(resolve(abs), join(lib, path), 'ARTIFACT_PATH_ESCAPE');
      if (stat.isDirectory()) {
        walk(abs, path, depth + 1);
      } else {
        assert.ok(stat.isFile() && stat.size <= SIZE_LIMIT, 'ARTIFACT_FILE_INVALID');
        totalBytes += stat.size;
        assert.ok(all.length < FILE_LIMIT && totalBytes <= TOTAL_LIMIT,
          'ARTIFACT_INVENTORY_LIMIT_EXCEEDED');
        const bytes = readFileSync(abs);
        assert.equal(bytes.length, stat.size, 'ARTIFACT_FILE_CHANGED_DURING_READ');
        all.push({ path, sha256: sha256(bytes), bytes: bytes.length });
      }
    }
  }
  walk(lib, '', 0);
  assert.ok(all.length >= JOBS261_EMULATOR_IMPORTS.length, 'ARTIFACT_TREE_TOO_SMALL');
  all.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const byPath = new Map(all.map(item => [item.path, item]));
  const direct = JOBS261_EMULATOR_IMPORTS.map(path => {
    const item = byPath.get(path);
    assert.ok(item && item.bytes > 0, 'ARTIFACT_IMPORT_NOT_FOUND: ' + path);
    return item;
  });
  const serialized = all.map(item => item.path + '\t' + item.sha256 + '\t' + item.bytes + '\n').join('');
  return { files: direct, treeSha256: sha256(Buffer.from(serialized)), treeCount: all.length, treeBytes: totalBytes };
}
/** Capture ONLY after the exact detached source's frozen, trusted build. */
export function captureJobs261GeneratedManifest(directory) {
  const body = JSON.stringify({ schemaVersion: MANIFEST_VERSION, ...compiledInventory(directory) });
  return { manifest: body, digest: sha256(Buffer.from(body)) };
}
/** Check expected manifest supplied independently of this verification. */
export function assertJobs261GeneratedManifest({ directory, manifest, digest }) {
  assert.ok(typeof manifest === 'string' && Buffer.byteLength(manifest) < 4096, 'ARTIFACT_MANIFEST_INVALID');
  assert.ok(typeof digest === 'string' && DIGEST.test(digest), 'ARTIFACT_EXPECTED_DIGEST_REQUIRED');
  assert.equal(sha256(Buffer.from(manifest)), digest, 'ARTIFACT_MANIFEST_DIGEST_MISMATCH');
  const parsed = JSON.parse(manifest);
  assert.deepEqual(Object.keys(parsed).sort(), ['files', 'schemaVersion', 'treeBytes', 'treeCount', 'treeSha256']);
  assert.equal(parsed.schemaVersion, MANIFEST_VERSION, 'ARTIFACT_MANIFEST_VERSION_MISMATCH');
  assert.ok(Array.isArray(parsed.files) && parsed.files.length === JOBS261_EMULATOR_IMPORTS.length,
    'ARTIFACT_MANIFEST_FILE_COUNT_MISMATCH');
  assert.match(String(parsed.treeSha256), DIGEST, 'ARTIFACT_MANIFEST_TREE_DIGEST_INVALID');
  const actual = { schemaVersion: MANIFEST_VERSION, ...compiledInventory(directory) };
  assert.deepEqual(parsed, actual, 'JOBS_COMPILED_ARTIFACT_DRIFT');
  return true;
}
