/**
 * R560 review-only generated-artifact integrity check.
 * The expected manifest digest MUST be captured out-of-band immediately after
 * an immutable, frozen-lockfile Jobs build; never accept a digest derived from
 * the files being checked during the verification phase.
 * This prevents post-build replacement, NOT an untrusted or malicious build,
 * and does not prove production IAM or authorize a Life Movie render.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';

export const JOBS261_EMULATOR_IMPORTS = Object.freeze([
  'functions/jobs/studioLifeMovieContract.js',
  'functions/privacy/lifeMovieFirebaseOwnerState.js',
  'functions/privacy/lifeMovieFirebaseSourceRightsAdapter.js',
  'functions/privacy/lifeMovieDerivativeRevocation.js',
]);
const DIGEST = /^[0-9a-f]{64}$/;
const SIZE_LIMIT = 10_000_000;
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function checkedRoot(directory) {
  assert.ok(typeof directory === 'string' && isAbsolute(directory), 'ARTIFACT_ABSOLUTE_ROOT_REQUIRED');
  const actual = realpathSync(directory);
  assert.ok(actual.startsWith('/tmp' + sep), 'ARTIFACT_DISPOSABLE_ROOT_REQUIRED');
  return actual;
}
function readArtifacts(directory) {
  const root = checkedRoot(directory);
  const lib = join(root, 'functions', 'lib');
  const statLib = lstatSync(lib);
  assert.ok(statLib.isDirectory() && !statLib.isSymbolicLink(), 'ARTIFACT_LIB_DIRECTORY_INVALID');
  assert.equal(realpathSync(lib), lib, 'ARTIFACT_LIB_SYMLINK_DENIED');
  return JOBS261_EMULATOR_IMPORTS.map(path => {
    const segments = path.split('/');
    let here = lib;
    for (const segment of segments) {
      assert.match(segment, /^[a-zA-Z0-9._-]+$/, 'ARTIFACT_PATH_INVALID');
      here = join(here, segment);
      const stat = lstatSync(here);
      assert.ok(!stat.isSymbolicLink(), 'ARTIFACT_SYMLINK_DENIED');
      if (segment !== segments.at(-1) || here !== join(lib, path)) {
        assert.ok(stat.isDirectory(), 'ARTIFACT_DIRECTORY_INVALID');
      } else {
        assert.ok(stat.isFile() && stat.size > 0 && stat.size <= SIZE_LIMIT, 'ARTIFACT_FILE_INVALID');
      }
    }
    assert.equal(resolve(here), join(lib, path), 'ARTIFACT_PATH_ESCAPE');
    const bytes = readFileSync(here);
    assert.ok(bytes.length > 0 && bytes.length <= SIZE_LIMIT, 'ARTIFACT_FILE_INVALID');
    return { path, sha256: sha256(bytes), bytes: bytes.length };
  });
}

/** Run exactly once after the verified frozen build, outside the test runner. */
export function captureJobs261GeneratedManifest(directory) {
  const files = readArtifacts(directory);
  const body = JSON.stringify({ schemaVersion: 'urai-jobs261-generated-review-v1', files });
  return { manifest: body, digest: sha256(Buffer.from(body)) };
}

/** Compare against a separately preserved post-build manifest and digest. */
export function assertJobs261GeneratedManifest({ directory, manifest, digest }) {
  assert.ok(typeof manifest === 'string' && Buffer.byteLength(manifest) < 4096, 'ARTIFACT_MANIFEST_INVALID');
  assert.ok(typeof digest === 'string' && DIGEST.test(digest), 'ARTIFACT_EXPECTED_DIGEST_REQUIRED');
  assert.equal(sha256(Buffer.from(manifest)), digest, 'ARTIFACT_MANIFEST_DIGEST_MISMATCH');
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.schemaVersion, 'urai-jobs261-generated-review-v1', 'ARTIFACT_MANIFEST_VERSION_MISMATCH');
  assert.deepEqual(Object.keys(parsed).sort(), ['files', 'schemaVersion']);
  assert.ok(Array.isArray(parsed.files) && parsed.files.length === JOBS261_EMULATOR_IMPORTS.length, 'ARTIFACT_MANIFEST_FILE_COUNT_MISMATCH');
  const actual = readArtifacts(directory);
  assert.deepEqual(parsed.files, actual, 'JOBS_COMPILED_ARTIFACT_DRIFT');
  return true;
}
