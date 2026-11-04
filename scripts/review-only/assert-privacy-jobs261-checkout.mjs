/**
 * R548: verify the immutable Jobs #261 review checkout before running Privacy's
 * disposable four-emulator bridge. This is not a production authorization.
 * The bridge itself still leaves positive C6 issuance and movie rendering off.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { isAbsolute, sep } from 'node:path';

export const EXACT_JOBS_SHA = 'b7a498e543160e64748a0679469a1fc1550acb3b';
export const EXACT_JOBS_TREE = 'f655a6200ff12106de49faa678d54db707d21549';
export const PINNED_BLOBS = Object.freeze({
  'functions/src/jobs/studioLifeMovieContract.ts': '5f944e906de7243d7415ac479cf92356b09c84c9',
  'functions/src/privacy/lifeMovieFirebaseOwnerState.ts': 'd2480062402ee8e81ae1c37a896b6acb2aa813a3',
  'functions/src/privacy/lifeMovieFirebaseSourceRightsAdapter.ts': '2cccc1009a8d18323d9feaf42f3f0df35b9edabd',
  'functions/src/privacy/lifeMovieDerivativeRevocation.ts': 'da3111e659423d537eae254928dd118f2e8315e2',
  'workers/studio-worker/index.js': 'b7f61c0dd996151320aac38f004fb6def62933d1',
  'workers/studio-worker/private-output-write-authority.js': 'ea6b25f3949ec2c17f65a9da68fa9cf937e86e76',
});
const realGit = (command, args) => execFileSync(command, args, {
  encoding: 'utf8', timeout: 10000, maxBuffer: 4096, windowsHide: true,
});

export function assertPrivacyJobs261Checkout({ directory, declaredSha }, git = realGit) {
  assert.equal(declaredSha, EXACT_JOBS_SHA, 'JOBS_DECLARED_SHA_MISMATCH');
  assert.ok(typeof directory === 'string' && isAbsolute(directory), 'JOBS_DISPOSABLE_ABSOLUTE_PATH_REQUIRED');
  const root = realpathSync(directory);
  assert.ok(root.startsWith('/tmp' + sep) && root.length > 5, 'JOBS_DISPOSABLE_TMP_CHECKOUT_REQUIRED');
  const read = (...args) => {
    const output = git('git', ['-C', root, ...args]);
    assert.equal(typeof output, 'string', 'JOBS_GIT_READ_FAILED');
    return output.trim();
  };
  assert.equal(read('rev-parse', 'HEAD'), EXACT_JOBS_SHA, 'JOBS_ACTUAL_HEAD_MISMATCH');
  assert.equal(read('rev-parse', 'HEAD^{tree}'), EXACT_JOBS_TREE, 'JOBS_ACTUAL_TREE_MISMATCH');
  for (const [path, expected] of Object.entries(PINNED_BLOBS)) {
    assert.equal(read('hash-object', '--', path), expected, 'JOBS_SOURCE_BLOB_MISMATCH: ' + path);
  }
  return true;
}
