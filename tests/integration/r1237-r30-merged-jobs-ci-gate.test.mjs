import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/r30-current-jobs-privacy-denial.yml', import.meta.url), 'utf8');
const runner = readFileSync(new URL('../../scripts/run-r30-native-jobs-privacy-acceptance.sh', import.meta.url), 'utf8');
const transport = readFileSync(new URL('./life-movie-jobs-r932-native-transport.emulator.mjs', import.meta.url), 'utf8');
const JOBS_MERGED_SHA = '1afeeb262824c8c440632e9d4b4d7bb04c229fd4';
const OLD_JOBS_SHA = 'd6c01f74141f3db3046e3437fca4a342fe60a938';
const PR_BRANCH = 'review/chalk-r1265-privacy-jobs508-native-hold-20261113';

test('exact R1265 review branch activates native denial CI without broadening to every PR', () => {
  assert.ok(workflow.includes(`github.head_ref == '${PR_BRANCH}'`));
  assert.match(workflow, /r30-native-denial:/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
});
test('workflow pins actual merged Jobs tree consistently with original runner and test', () => {
  assert.ok(workflow.includes(`ref: ${JOBS_MERGED_SHA}`));
  assert.ok(workflow.includes(`test "$(git -C jobs-source rev-parse HEAD)" = "${JOBS_MERGED_SHA}"`));
  assert.ok(runner.includes(`JOBS_SHA=${JOBS_MERGED_SHA}`));
  assert.ok(transport.includes(`const JOBS_SHA = '${JOBS_MERGED_SHA}'`));
  for (const source of [workflow, runner, transport]) assert.equal(source.includes(OLD_JOBS_SHA), false);
});
test('nested Jobs checkout moves out before Privacy clean-worktree assertion', () => {
  const move = workflow.indexOf('mv "$GITHUB_WORKSPACE/jobs-source" /tmp/urai-jobs-r1059');
  const clean = workflow.indexOf('test -z "$(git status --porcelain --untracked-files=all)"');
  assert.ok(move > 0);
  assert.ok(clean > move);
  assert.equal((workflow.match(/test -z "\$\(git status --porcelain --untracked-files=all\)"/g) || []).length, 1);
});
test('CI retains credential and immutable source restrictions', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /test -n "\$R30_JOBS_READ_TOKEN"/);
  assert.match(workflow, /persist-credentials: false/g);
  assert.match(runner, /Pinned Privacy SHA required/);
  assert.match(runner, /Jobs SHA mismatch/);
  assert.match(runner, /Credential or bucket selection present/);
  assert.match(runner, /positiveGrant=false render=false/);
});
