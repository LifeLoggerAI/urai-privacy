import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
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

// R555: actual Bash invocation with synthetic Git failure.  A failed fetch or
// checkout must never become an apparently green stage just because the final
// `git status` command happens to return an empty output.
function failGitAt(stage) {
  const dir = mkdtempSync(join(tmpdir(), 'urai-r555-fakegit-'));
  const fake = join(dir, 'git');
  const shim = `#!/bin/sh
case " $* " in
  *" fetch "*) if [ "$R555_FAIL_GIT_STAGE" = fetch ]; then exit 22; fi ;;
  *" checkout "*) if [ "$R555_FAIL_GIT_STAGE" = checkout ]; then exit 17; fi ;;
  *" rev-parse HEAD "*) printf '%s\\n' "$URAI_EXPECTED_PRIVACY_SHA"; exit 0 ;;
  *" rev-parse HEAD^{tree} "*) printf '%s\\n' 'f655a6200ff12106de49faa678d54db707d21549'; exit 0 ;;
esac
exit 0
`;
  writeFileSync(fake, shim, {mode:0o755});
  let result;
  try {
    result = invoke(['--execute-disposable'], {
      PATH: dir + ':' + process.env.PATH,
      R555_FAIL_GIT_STAGE: stage,
      URAI_DISPOSABLE_REVIEW:'YES_SYNTHETIC_ONLY',
      URAI_EXPECTED_PRIVACY_SHA:'4230e8f968ddd12ce4be32a32cd45566908dc124',
    });
  } finally {
    rmSync(dir, {force:true, recursive:true});
  }
  const found = result.stdout.match(/EVIDENCE_DIR=(\/tmp\/urai-r554-evidence-[^ ]+)/);
  if (found) rmSync(found[1], {force:true, recursive:true});
  return result;
}

test('R555: failed original Git fetch cannot produce a green checkout stage', () => {
  const r = failGitAt('fetch');
  assert.equal(r.status, 22);
  assert.match(r.stdout,/R554_STAGE=privacy_exact_fetch EXIT=22 /);
  assert.doesNotMatch(r.stdout,/R554_STAGE_BEGIN=jobs_exact_fetch/);
});
test('R555: failed exact-commit checkout cannot produce a green stage', () => {
  const r = failGitAt('checkout');
  assert.equal(r.status, 17);
  assert.match(r.stdout,/R554_STAGE=privacy_exact_fetch EXIT=17 /);
  assert.doesNotMatch(r.stdout,/R554_STAGE_BEGIN=jobs_exact_fetch/);
});


// R560: execute the runner's ACTUAL embedded Node receipt parser, instead of
// checking just for the presence of text. All cases use synthetic local logs.
const getReceiptValidator = () => {
  const anchor = 'node - "$EVIDENCE_ROOT/actual_four_emulator_bridge.log" <<' + "'NODE'\n";
  const start = source.indexOf(anchor);
  assert.ok(start !== -1, 'original receipt parser must remain in the runner');
  const contentStart = start + anchor.length;
  const end = source.indexOf('\nNODE\n', contentStart);
  assert.ok(end > contentStart, 'original receipt parser terminator missing');
  return source.slice(contentStart, end);
};
const validReceipt = Object.freeze({
  checksPassed: 23, authEmulator: true, firestoreEmulator: true,
  storageEmulator: true, functionsEmulator: true,
  jobSourceAuditReadFromRealAuthFirestoreStorage: true,
  productionAuthorized: false, renderEnabled: false,
  approvedOwnerC6ConsentIssuer: false,
  productionSignedJobsIdentityVerified: false, finalReleaseAccepted: false,
});
const runReceipt = ({receipt=validReceipt, parity=true, parityHash='a'.repeat(64)}={}) => {
  const folder = mkdtempSync(join(tmpdir(), 'urai-r560-receipt-'));
  const log = join(folder, 'synthetic-four-emulator.log');
  try {
    const rows = [];
    if (parity) rows.push('R558_JOBS_COMPILED_ARTIFACT_PARITY_PASS 12 ' + parityHash);
    rows.push('R454_REVIEW_ONLY_FIRESTORE_PASS ' + JSON.stringify(receipt));
    writeFileSync(log, rows.join('\n') + '\n');
    return spawnSync(process.execPath, ['-', log], {
      input: getReceiptValidator(), encoding: 'utf8', timeout: 10000,
    });
  } finally {
    rmSync(folder, {recursive:true, force:true});
  }
};
test('R560: the actual receipt parser accepts both exact parity and four synthetic emulators', () => {
  const r=runReceipt();
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/R554_VERIFIED_REVIEW_RECEIPT_CHECKS=23 PRODUCTION_AUTHORIZED=false/);
});
test('R560: receipt without compiled Jobs parity is denied', () => {
  const r=runReceipt({parity:false});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/missing or malformed original fresh-compiled Jobs parity receipt/);
});
test('R560: tampered compiled-parity hash is denied', () => {
  const r=runReceipt({parityHash:'untrusted-hash'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/missing or malformed original fresh-compiled Jobs parity receipt/);
});
test('R560: three emulators without Storage are never a four-emulator pass', () => {
  const r=runReceipt({receipt:{...validReceipt,storageEmulator:false}});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/incomplete, unsafe, or misclassified/);
});
test('R560: insufficient completed bridge assertions are denied', () => {
  const r=runReceipt({receipt:{...validReceipt,checksPassed:22}});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/incomplete, unsafe, or misclassified/);
});
test('R560: any production authorization flag disqualifies a review-only bridge receipt', () => {
  for (const key of ['productionAuthorized','renderEnabled','finalReleaseAccepted']) {
    const r=runReceipt({receipt:{...validReceipt,[key]:true}});
    assert.notEqual(r.status,0,key);
  }
});
