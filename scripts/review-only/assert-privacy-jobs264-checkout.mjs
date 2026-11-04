/**
 * R548: verify the immutable Jobs #264 review checkout before running Privacy's
 * disposable four-emulator bridge. This is not a production authorization.
 * The bridge itself still leaves positive C6 issuance and movie rendering off.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { isAbsolute, sep } from 'node:path';

export const EXACT_JOBS_SHA = 'e2a700bd186c4dcff47c6da763e647992145d8b0';
export const EXACT_JOBS_TREE = '9ca86b4a60ef2969203819a52ff9f827ac710d59';
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

export function assertPrivacyJobs264Checkout({ directory, declaredSha }, git = realGit) {
  assert.equal(declaredSha, EXACT_JOBS_SHA, 'JOBS_DECLARED_SHA_MISMATCH');
  assert.ok(typeof directory === 'string' && isAbsolute(directory), 'JOBS_DISPOSABLE_ABSOLUTE_PATH_REQUIRED');
  const root = realpathSync(directory);
  assert.ok(root.startsWith('/tmp' + sep) && root.length > 5, 'JOBS_DISPOSABLE_TMP_CHECKOUT_REQUIRED');
  const read = (...args) => {
    const output = git('git', ['-C', root, ...args]);
    assert.equal(typeof output, 'string', 'JOBS_GIT_READ_FAILED');
    return output.trim();
  };
  // A matching SHA is not sufficient if -C resolves a different worktree, or
  // if a movable branch remains attached to the disposable review checkout.
  assert.equal(read('rev-parse', '--show-toplevel'), root, 'JOBS_GIT_TOPLEVEL_MISMATCH');
  assert.equal(read('rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD', 'JOBS_CHECKOUT_NOT_DETACHED');
  assert.equal(read('rev-parse', 'HEAD'), EXACT_JOBS_SHA, 'JOBS_ACTUAL_HEAD_MISMATCH');
  assert.equal(read('rev-parse', 'HEAD^{tree}'), EXACT_JOBS_TREE, 'JOBS_ACTUAL_TREE_MISMATCH');
  // Catch staged or unstaged tracked changes outside the six pinned contract files.
  // Generated/ignored build outputs still require their own artifact proof.
  assert.equal(read('status', '--porcelain=v1', '--untracked-files=no'), '', 'JOBS_TRACKED_WORKTREE_DIRTY');
  for (const [path, expected] of Object.entries(PINNED_BLOBS)) {
    assert.equal(read('hash-object', '--', path), expected, 'JOBS_SOURCE_BLOB_MISMATCH: ' + path);
  }
  return true;
}
