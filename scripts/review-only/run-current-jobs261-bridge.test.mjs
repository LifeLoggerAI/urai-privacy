import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, 'run-current-jobs261-bridge.sh');
const source = readFileSync(script, 'utf8');
const invoke = (args, env={}) => spawnSync('bash', [script, ...args], {encoding:'utf8',env:{...process.env,...env},timeout:4000});

test('R554: script parses as Bash', () => assert.doesNotThrow(() => execFileSync('bash',['-n',script])));
test('R554: print-plan is offline, labeled review only and HOLD', () => {
  const r=invoke(['--plan']); assert.equal(r.status,0); assert.match(r.stdout,/Auth\+Firestore\+Storage\+Functions/); assert.match(r.stdout,/HOLD/); assert.match(r.stdout,/unverified/i);
});
test('R554: default command fails closed', () => {
  const r=invoke([]); assert.equal(r.status,2); assert.match(r.stderr,/DENIED/);
});
test('R554: execution requires explicit synthetic-only opt-in', () => {
  const r=invoke(['--execute-disposable']); assert.equal(r.status,2); assert.match(r.stderr,/YES_SYNTHETIC_ONLY/);
});
test('R554: execution requires explicit exact Privacy SHA', () => {
  const r=invoke(['--execute-disposable'],{URAI_DISPOSABLE_REVIEW:'YES_SYNTHETIC_ONLY'}); assert.equal(r.status,2); assert.match(r.stderr,/40-hex/);
});
test('R554: shell checkout function is executable under the stage runner', () => {
  assert.match(source, /if \[\[ "\$\{1:-\}" == fetch_exact \]\]/);
  assert.match(source, /\( fetch_exact "\$@" \)/);
  assert.match(source, /timeout -k 10 180 git -C/);
});
test('R554: alternate Jobs SHA is impossible without source review', () => {
  assert.match(source,/JOBS_SHA='b7a498e543160e64748a0679469a1fc1550acb3b'/);
  assert.match(source,/JOBS_TREE='f655a6200ff12106de49faa678d54db707d21549'/);
  assert.match(source,/--no-tags --depth=1 origin "\$sha"/);
  assert.match(source,/checkout --quiet --detach FETCH_HEAD/);
});
test('R554: frozen no-script package installs and actual dual-head build are required', () => {
  for(const term of ['--frozen-lockfile --ignore-scripts','ci --ignore-scripts','jobs_shared_types_build','jobs_functions_build','privacy_functions_build','privacy_next_build','privacy_unit','actual_four_emulator_bridge']) assert.ok(source.includes(term),term);
});
test('R554: bridge test uses approved local emulators and exact source path', () => {
  assert.match(source,/test:life-movie:jobs-rights:bridge:emulated/);
  assert.match(source,/URAI_JOBS_SOURCE_SHA="\$JOBS_SHA"/);
  assert.match(source,/URAI_JOBS_DIR="\$JOBS_DIR"/);
});
test('R554: deny cloud credential variables and no production mutation commands', () => {
  for(const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','GOOGLE_CLOUD_PROJECT'])assert.ok(source.includes(name));
  assert.doesNotMatch(source,/\bfirebase deploy\b|\bgcloud .*deploy\b|\bgsutil iam ch\b/);
  assert.match(source,/productionAuthorized=false/);
});
test('R554: original 23+ checkpoint marker and negative production flags are required', () => {
  assert.match(source, /R454_REVIEW_ONLY_FIRESTORE_PASS/);
  assert.match(source, /r\.checksPassed < 23/);
  for(const field of ['authEmulator','firestoreEmulator','functionsEmulator','productionAuthorized','renderEnabled','approvedOwnerC6ConsentIssuer','productionSignedJobsIdentityVerified','finalReleaseAccepted']) assert.ok(source.includes('r.' + field));
});
test('R554: generated Jobs JS module hashes are captured after fresh build', () => {
  for(const mod of [
    'studioLifeMovieContract.js',
    'lifeMovieFirebaseOwnerState.js',
    'lifeMovieFirebaseSourceRightsAdapter.js',
    'lifeMovieDerivativeRevocation.js',
  ]) assert.ok(source.includes(mod));
  assert.ok(source.includes('COMPILED_JOBS_SHA256SUMS.txt'));
  assert.match(source, /DENIED: missing compiled Jobs module/);
});
test('R554: tracked source remains immutable after frozen builds', () => {
  assert.match(source, /DENIED: Privacy checked-out HEAD moved during build/);
  assert.match(source, /DENIED: unexpected tracked Privacy changes after build/);
  assert.match(source, /DENIED: dirty tracked source after frozen builds/);
});
test('R554: logs have hashes, retained privately, and temporary cloned sources are cleaned', () => {
  assert.match(source,/sha256sum/);
  assert.match(source,/EVIDENCE_ROOT="\$\(mktemp -d \/tmp\/urai-r554-evidence/);
  assert.match(source,/rm -rf -- "\$RUN_ROOT"/);
});
