/**
 * R647 REVIEW ONLY: independently check the exact Jobs #272 source as a
 * descendant of Privacy's previously anchored Jobs #264 source.
 *
 * No model test or source lineage check can approve a Storage write, deletion
 * acknowledgement, current compiled artifact, live provider IAM or release.
 * This intentionally DOES NOT replace the existing Jobs #264 four-service
 * emulator bridge and its independent generated-JS fingerprints.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { isAbsolute, sep } from 'node:path';

export const JOBS264_BASE_SHA = 'e2a700bd186c4dcff47c6da763e647992145d8b0';
export const JOBS272_REVIEW_SHA = 'ee548bc15d059ec98f2d8bddb004f5ec0df0a5b8';
export const JOBS272_REVIEW_TREE = '74c0c8ca5d3ce19827ed5c563ae83faabc4c900e';
export const JOBS272_EXPECTED_COMMITS = 9;

// These source blobs are *unchanged* between Jobs #264 and the #272 head.
// They protect the authority and cleanup implementation against silent drift.
export const UNCHANGED_PRODUCTION_BLOBS = Object.freeze({
  'functions/src/jobs/studioLifeMovieContract.ts': '5f944e906de7243d7415ac479cf92356b09c84c9',
  'functions/src/privacy/lifeMovieFirebaseOwnerState.ts': 'd2480062402ee8e81ae1c37a896b6acb2aa813a3',
  'functions/src/privacy/lifeMovieFirebaseSourceRightsAdapter.ts': '2cccc1009a8d18323d9feaf42f3f0df35b9edabd',
  'functions/src/privacy/lifeMovieDerivativeRevocation.ts': 'da3111e659423d537eae254928dd118f2e8315e2',
  'functions/src/privacy/lifeMovieWriteReservationsReview.ts': '88126bbbcff6188b9c3d8f1aadda84b33404dacd',
  'workers/studio-worker/index.js': 'b7f61c0dd996151320aac38f004fb6def62933d1',
  'workers/studio-worker/private-output-write-authority.js': 'ea6b25f3949ec2c17f65a9da68fa9cf937e86e76',
  'scripts/life-movies-late-write-storage-boundary.firebase-emulator.mjs': '98b1d5e3abaa98cdeb8844a2e1c294281735c0e5',
});

// Full allowed diff for the nine commits. Any other path requires a new
// independently reviewed source pin, NOT broadening this list at runtime.
export const REVIEW_DIFF_BLOBS = Object.freeze({
  'docs/security/R584_CLOUD_RUN_EXECUTION_IAM_EVIDENCE_HOLD.md': 'c62621dd9f1263e20f715b7ddaf469e9ad4cd3cf',
  'package-lock.json': '197b02617cb068f94fc06b2bb709ccfa4cc151df',
  'scripts/capture-studio-storage-iam-evidence.test.mjs': '66d9341bdac729b5d7669b06db83d9fb678f0b68',
  'scripts/life-movie-writer-fence-race-model.test.mjs': 'bb2ae16bf81eb44d08fbd38134e9a20d27c61c8c',
  'scripts/review-only/capture-studio-storage-iam-evidence.mjs': '125ebd3d28c0aebae8945b5a011b1d223847316c',
  'scripts/review-only/life-movie-writer-fence-model.mjs': '6526c5f5b1bfe1ddcd8bd50204e9639ea7f71e05',
  'scripts/review-only/r587-regenerate-frozen-lockfile-hold.sh': 'd0d151c135d8c45415e24cce8f12a6eb582c5240',
  'scripts/review-only/studio-storage-iam-snapshot-audit.mjs': '8c001c3a2ab62f3651bf1a8749748461cf0a6383',
  'scripts/studio-storage-iam-snapshot-audit.test.mjs': 'f962bd48028674aff5824ad2439ac49eaf7c1cdf',
});

const realGit = (command, args) => execFileSync(command, args, {
  encoding: 'utf8', timeout: 10_000, maxBuffer: 8192, windowsHide: true,
});

export function assertJobs272ReviewSource({ directory, declaredSha }, git = realGit) {
  assert.equal(declaredSha, JOBS272_REVIEW_SHA, 'JOBS272_DECLARED_SHA_NOT_REVIEWED');
  assert.ok(typeof directory === 'string' && isAbsolute(directory), 'JOBS272_ABSOLUTE_PATH_REQUIRED');
  const root = realpathSync(directory);
  assert.ok(root.startsWith('/tmp' + sep), 'JOBS272_DISPOSABLE_CHECKOUT_REQUIRED');
  const read = (...args) => {
    const output = git('git', ['-C', root, ...args]);
    assert.equal(typeof output, 'string', 'JOBS272_GIT_OUTPUT_INVALID');
    return output.trim();
  };
  assert.equal(read('rev-parse', '--show-toplevel'), root, 'JOBS272_UNEXPECTED_GIT_ROOT');
  assert.equal(read('rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD', 'JOBS272_CHECKOUT_NOT_DETACHED');
  assert.equal(read('rev-parse', 'HEAD'), JOBS272_REVIEW_SHA, 'JOBS272_ACTUAL_HEAD_MISMATCH');
  assert.equal(read('rev-parse', 'HEAD^{tree}'), JOBS272_REVIEW_TREE, 'JOBS272_TREE_MISMATCH');
  assert.equal(read('status', '--porcelain=v1', '--untracked-files=no'), '', 'JOBS272_TRACKED_SOURCE_DIRTY');

  // Require actual Git ancestry: a caller cannot merely claim a newer SHA.
  try { read('merge-base', '--is-ancestor', JOBS264_BASE_SHA, JOBS272_REVIEW_SHA); }
  catch { throw new Error('JOBS272_ANCESTRY_NOT_VERIFIED'); }
  assert.equal(read('rev-list', '--count', `${JOBS264_BASE_SHA}..${JOBS272_REVIEW_SHA}`),
    String(JOBS272_EXPECTED_COMMITS), 'JOBS272_UNEXPECTED_HISTORY');

  const observedDiff = read('diff', '--name-only', JOBS264_BASE_SHA, JOBS272_REVIEW_SHA, '--')
    .split('\n').filter(Boolean).sort();
  assert.deepEqual(observedDiff, Object.keys(REVIEW_DIFF_BLOBS).sort(), 'JOBS272_UNREVIEWED_PATH_CHANGE');
  for (const [path, sha] of Object.entries({ ...UNCHANGED_PRODUCTION_BLOBS, ...REVIEW_DIFF_BLOBS })) {
    assert.equal(read('hash-object', '--', path), sha, 'JOBS272_BLOB_MISMATCH: ' + path);
  }

  return Object.freeze({
    reviewedSourceSha: JOBS272_REVIEW_SHA,
    sourceLineageVerified: true,
    unchangedProductionSourcesVerified: true,
    generatedModulesVerified: false,
    privacyFourEmulatorsVerified: false,
    liveEffectiveStorageIamVerified: false,
    deletionAckPermitted: false,
    productionAuthorized: false,
    releaseGo: false,
  });
}
