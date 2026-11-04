import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPrivacyJobs261Checkout, EXACT_JOBS_SHA, EXACT_JOBS_TREE, PINNED_BLOBS } from './review-only/assert-privacy-jobs261-checkout.mjs';

const root = mkdtempSync(join(tmpdir(), 'urai-r548-jobs-checkout-'));
const verified = (mutate = () => {}) => {
  const calls = [];
  const git = (cmd, args) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args.slice(0, 2), ['-C', root]);
    calls.push(args.slice(2));
    const [action, ref, path] = args.slice(2);
    let output = action === 'rev-parse'
      ? (ref === 'HEAD' ? EXACT_JOBS_SHA
        : ref === 'HEAD^{tree}' ? EXACT_JOBS_TREE
        : ref === '--show-toplevel' ? root
        : ref === '--abbrev-ref' && path === 'HEAD' ? 'HEAD' : undefined)
      : (action === 'hash-object' && ref === '--' ? PINNED_BLOBS[path] : undefined);
    output = mutate({ action, ref, path, output });
    return (output ?? '') + '\n';
  };
  return { git, calls };
};
const args = { directory: root, declaredSha: EXACT_JOBS_SHA };

test('R548: exact Jobs commit, tree and six contract/worker blobs match', () => {
  const v = verified(({output}) => output);
  assert.equal(assertPrivacyJobs261Checkout(args, v.git), true);
  assert.equal(v.calls.length, 11);
  assert.equal(v.calls.filter(x => x[0] === 'hash-object').length, 6);
});
test('R548: caller cannot supply an older Jobs donor SHA', () => {
  assert.throws(() => assertPrivacyJobs261Checkout({ ...args, declaredSha: '358fa584ff814d9e58762dd21232daf1963e8cfa' }, verified().git), /JOBS_DECLARED_SHA_MISMATCH/);
});
test('R548: checkout HEAD and tree must match immutable source', () => {
  assert.throws(() => assertPrivacyJobs261Checkout(args, verified(({action, ref, output}) => action === 'rev-parse' && ref === 'HEAD' ? '0'.repeat(40) : output).git), /JOBS_ACTUAL_HEAD_MISMATCH/);
  assert.throws(() => assertPrivacyJobs261Checkout(args, verified(({action, ref, output}) => action === 'rev-parse' && ref === 'HEAD\^\{tree\}' ? '0'.repeat(40) : output).git), /JOBS_ACTUAL_TREE_MISMATCH/);
});
test('R548: modified Jobs contract and hard-off worker blobs are rejected', () => {
  for (const path of Object.keys(PINNED_BLOBS)) {
    assert.throws(() => assertPrivacyJobs261Checkout(args, verified(({action, path:p, output}) => action === 'hash-object' && p === path ? '0'.repeat(40) : output).git), /JOBS_SOURCE_BLOB_MISMATCH/);
  }
});
test('R548: non-disposable and relative paths fail closed', () => {
  for (const directory of ['relative-dir', '/', '/tmp']) {
    assert.throws(() => assertPrivacyJobs261Checkout({directory, declaredSha: EXACT_JOBS_SHA}, verified().git));
  }
});
test('R551: Git top level must equal the canonical disposable checkout root', () => {
  const v = verified(({ action, ref, output }) =>
    action === 'rev-parse' && ref === '--show-toplevel' ? '/tmp/redirected-worktree' : output);
  assert.throws(() => assertPrivacyJobs261Checkout(args, v.git), /JOBS_GIT_TOPLEVEL_MISMATCH/);
});
test('R551: attached/movable branch must be rejected even at the pinned commit', () => {
  const v = verified(({ action, ref, output }) =>
    action === 'rev-parse' && ref === '--abbrev-ref' ? 'review/movable-branch' : output);
  assert.throws(() => assertPrivacyJobs261Checkout(args, v.git), /JOBS_CHECKOUT_NOT_DETACHED/);
});
test('R552: reject unstaged modifications outside six pinned Jobs files', () => {
  const v = verified(({ action, output }) => action === 'status' ? ' M functions/src/privacy/unpinned-check.ts' : output);
  assert.throws(() => assertPrivacyJobs261Checkout(args, v.git), /JOBS_TRACKED_WORKTREE_DIRTY/);
});
test('R552: reject staged modifications outside six pinned Jobs files', () => {
  const v = verified(({ action, output }) => action === 'status' ? 'M  scripts/unpinned-check.mjs' : output);
  assert.throws(() => assertPrivacyJobs261Checkout(args, v.git), /JOBS_TRACKED_WORKTREE_DIRTY/);
});
test('R548: missing Git or inaccessible source is denied', () => {
  assert.throws(() => assertPrivacyJobs261Checkout(args, () => { throw Error('mock git failure'); }), /mock git failure/);
});
test('R548: this guard does not mint a production grant or enable rendering', () => {
  assert.equal(Object.keys(PINNED_BLOBS).length, 6);
  assert.ok(!Object.keys(PINNED_BLOBS).some(p => /issuer|token|credential/.test(p)));
});
test.after(() => rmSync(root, {recursive: true, force: true}));
