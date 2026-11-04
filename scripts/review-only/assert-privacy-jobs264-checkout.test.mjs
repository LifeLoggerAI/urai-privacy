import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EXACT_JOBS_SHA, EXACT_JOBS_TREE, PINNED_BLOBS,
  assertPrivacyJobs264Checkout,
} from './assert-privacy-jobs264-checkout.mjs';

const NEW_SHA = 'e2a700bd186c4dcff47c6da763e647992145d8b0';
const NEW_TREE = '9ca86b4a60ef2969203819a52ff9f827ac710d59';
const OLD_SHA = 'b7a498e543160e64748a0679469a1fc1550acb3b';
const sources = Object.freeze({
  'functions/src/jobs/studioLifeMovieContract.ts': '5f944e906de7243d7415ac479cf92356b09c84c9',
  'functions/src/privacy/lifeMovieFirebaseOwnerState.ts': 'd2480062402ee8e81ae1c37a896b6acb2aa813a3',
  'functions/src/privacy/lifeMovieFirebaseSourceRightsAdapter.ts': '2cccc1009a8d18323d9feaf42f3f0df35b9edabd',
  'functions/src/privacy/lifeMovieDerivativeRevocation.ts': 'da3111e659423d537eae254928dd118f2e8315e2',
  'workers/studio-worker/index.js': 'b7f61c0dd996151320aac38f004fb6def62933d1',
  'workers/studio-worker/private-output-write-authority.js': 'ea6b25f3949ec2c17f65a9da68fa9cf937e86e76',
  'functions/src/privacy/lifeMovieWriteReservationsReview.ts': '88126bbbcff6188b9c3d8f1aadda84b33404dacd',
  'scripts/review-only/life-movie-writer-fence-model.mjs': '8e7e74b7f1dbe28b59b7f707a71e1f6b0d787933',
  'scripts/life-movie-writer-fence-race-model.test.mjs': 'b812ca8f8b748ab1566afcb1e3265bdf04950b1a',
  'scripts/life-movies-late-write-storage-boundary.firebase-emulator.mjs': '98b1d5e3abaa98cdeb8844a2e1c294281735c0e5',
});

function fixture(mutator = () => {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'urai-r579-pin-')));
  const state = {
    commit: NEW_SHA,
    tree: NEW_TREE,
    branch: 'HEAD',
    status: '',
    blobs: { ...sources },
    top: root,
  };
  mutator(state);
  const git = (cmd, args) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args.slice(0, 2), ['-C', root]);
    const command = args.slice(2);
    const first = command[0];
    if (first === 'rev-parse') {
      if (command[1] === '--show-toplevel') return state.top + '\n';
      if (command[1] === '--abbrev-ref') return state.branch + '\n';
      if (command[1] === 'HEAD') return state.commit + '\n';
      if (command[1] === 'HEAD^{tree}') return state.tree + '\n';
    }
    if (first === 'status') return state.status;
    if (first === 'hash-object') return (state.blobs[command.at(-1)] ?? '') + '\n';
    throw new Error('UNEXPECTED_GIT_OP ' + command.join(' '));
  };
  return {
    root, state, git,
    close() { rmSync(root, { recursive: true, force: true }); },
    verify(sha = NEW_SHA) { return assertPrivacyJobs264Checkout({ directory: root, declaredSha: sha }, git); },
  };
}
function expectDeny(name, mutate, expected) {
  test(name, () => {
    const f = fixture(mutate);
    try { assert.throws(() => f.verify(), expected); } finally { f.close(); }
  });
}

test('R579 pin is immutable Jobs #264 and exact ten independently read-back production source blobs', () => {
  assert.equal(EXACT_JOBS_SHA, NEW_SHA);
  assert.equal(EXACT_JOBS_TREE, NEW_TREE);
  assert.notEqual(EXACT_JOBS_SHA, OLD_SHA);
  assert.deepEqual(PINNED_BLOBS, sources);
});
test('R579 allows only a detached clean Jobs #264 source with ten correct blobs', () => {
  const f = fixture();
  try { assert.equal(f.verify(), true); } finally { f.close(); }
});
test('R579 refuses superseded Jobs #261 declaration before examining source', () => {
  const f = fixture();
  try { assert.throws(() => f.verify(OLD_SHA), /JOBS_DECLARED_SHA_MISMATCH/); } finally { f.close(); }
});
expectDeny('R579 rejects mismatched checked-out HEAD', s => { s.commit = OLD_SHA; }, /JOBS_ACTUAL_HEAD_MISMATCH/);
expectDeny('R579 rejects mismatched Jobs Git tree', s => { s.tree = '0'.repeat(40); }, /JOBS_ACTUAL_TREE_MISMATCH/);
expectDeny('R579 rejects non-detached movable branch', s => { s.branch = 'main'; }, /JOBS_CHECKOUT_NOT_DETACHED/);
expectDeny('R579 rejects dirty tracked Jobs source', s => { s.status = ' M functions/src/jobs/studioLifeMovieContract.ts\n'; }, /JOBS_TRACKED_WORKTREE_DIRTY/);
for (const path of Object.keys(sources)) {
  expectDeny('R579 rejects drift in ' + path,
    s => { s.blobs[path] = '0'.repeat(40); },
    /JOBS_SOURCE_BLOB_MISMATCH/);
}
