import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const runner = readFileSync(new URL('../../scripts/run-r818-native-jobs-privacy-acceptance.sh', import.meta.url), 'utf8');
const nativeTest = readFileSync(new URL('./life-movie-jobs-native-transport.emulator.mjs', import.meta.url), 'utf8');
const config = JSON.parse(readFileSync(new URL('../../firebase.emulators.json', import.meta.url), 'utf8'));
const project = 'demo-urai-privacy-integration-test';
const jobsSha = 'ea8f0165ac74511a4e4196919ddd3109d0c1ff2e';

test('R823 native runner pins fictional demo-only Firebase project', () => {
  assert.match(runner, /^PROJECT=demo-urai-privacy-integration-test$/m);
  assert.doesNotMatch(runner, /^PROJECT=urai-privacy-integration-test$/m);
  assert.match(runner, /--project "\$PROJECT" emulators:exec/);
});

test('R823 native test pins exactly the same demo project and has no old project literal', () => {
  assert.match(nativeTest, /^const PROJECT = 'demo-urai-privacy-integration-test';$/m);
  assert.ok(!nativeTest.includes("'urai-privacy-integration-test'"));
  assert.match(nativeTest, /const EMULATOR_AUTH_URL =/);
  assert.match(nativeTest, /const EMULATOR_PRIVACY_URL =/);
});

test('R823 ephemeral test signing identity belongs to isolated demo project', () => {
  assert.match(nativeTest, /r818-ephemeral-test@demo-urai-privacy-integration-test\.iam\.gserviceaccount\.com/);
  assert.match(nativeTest, /syntheticSignedIdTokenCount/);
  assert.match(nativeTest, /mintedSignedProductionIdentity: false/);
});

test('R834 runner and native transport pin same reviewed R833 Jobs commit', () => {
  assert.match(runner, new RegExp('^JOBS_SHA=' + jobsSha + '$', 'm'));
  assert.match(nativeTest, new RegExp("^const JOBS_SHA = '" + jobsSha + "';$", 'm'));
  assert.match(runner, /git -C "\$JOBS_DIR" rev-parse HEAD/);
  assert.match(nativeTest, /git\(jobs, 'rev-parse', 'HEAD'\)/);
});

test('R823 uses real four local Firebase emulators with single project enforcement', () => {
  assert.equal(config.emulators.singleProjectMode, true);
  for (const service of ['auth', 'firestore', 'functions', 'storage']) {
    assert.equal(config.emulators[service].host, '127.0.0.1');
    assert.ok(Number.isInteger(config.emulators[service].port));
  }
  assert.match(runner, /--only auth,firestore,functions,storage/);
});

test('R823 retains credential and inherited project/host refusals', () => {
  for (const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','FIREBASE_CLI_TOKEN','GITHUB_TOKEN','RUNPOD_API_KEY','FIREBASE_CONFIG','GCS_BUCKET_NAME','FIREBASE_STORAGE_BUCKET']) {
    assert.ok(runner.includes(name), name + ' must remain refused by runner');
  }
  for (const name of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','FIREBASE_PROJECT_ID','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST']) {
    assert.ok(runner.includes(name), name + ' pre-existing overrides must remain refused');
  }
});

const issuerTest = readFileSync(new URL('./life-movie-review-issuer-firestore.emulator.mjs', import.meta.url), 'utf8');
const issuerAdapter = readFileSync(new URL('../../functions/src/life-movie-scoped-issuer-firestore-emulator.ts', import.meta.url), 'utf8');
const issuer = readFileSync(new URL('../../functions/src/life-movie-scoped-issuer-review.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

test('R825 original scoped C6 issuer and Jobs denial test share disposable demo project', () => {
  assert.match(issuerTest, /^const PROJECT = "demo-urai-privacy-integration-test";$/m);
  assert.match(issuerAdapter, /^const PROJECT = "demo-urai-privacy-integration-test";$/m);
  assert.ok(issuerTest.includes('synthetic-verifier@demo-urai-privacy-integration-test.iam.gserviceaccount.com'));
  assert.equal(packageJson.scripts['test:life-movie:review:firestore:emulated'].includes('--project demo-urai-privacy-integration-test'), true);
  assert.equal(packageJson.scripts['test:life-movie:review:firestore:emulated'].includes('URAI_EMULATOR_PROJECT=demo-urai-privacy-integration-test'), true);
  assert.doesNotMatch(issuerTest, /["']urai-privacy-integration-test["']/);
  assert.doesNotMatch(issuerAdapter, /["']urai-privacy-integration-test["']/);
});

test('R825 composite four-emulator gate retains both originals and never admits production C6', () => {
  assert.match(runner, /--only auth,firestore,functions,storage/);
  assert.match(runner, /node tests\/integration\/life-movie-jobs-native-transport\.emulator\.mjs && node tests\/integration\/life-movie-review-issuer-firestore\.emulator\.mjs/);
  assert.match(runner, /productionGrant=false render=false/);
  assert.match(issuerTest, /reviewOnlyEmulator, true/);
  assert.match(issuerTest, /productionAuthorized, false/);
  assert.match(issuer, /productionAuthorized: false/);
  assert.match(issuer, /optionalOwnerLifecycleFenceClear\(record, "disabled"\)/);
  assert.match(issuer, /optionalOwnerLifecycleFenceClear\(record, "dataRightsDeletionPendingCentralPrivacy"\)/);
});

test('R826 bounded original native gates retain fatal failure and source-pinned receipts', () => {
  // Literal command comparisons avoid regex-escape ambiguity for Bash $vars.
  for (const command of [
    'timeout -k 30s "$limit" "$@" > "$OUT/$name.log" 2>&1 || code=$?',
    'sha256sum "$OUT/$name.log"',
    'die "Native stage $name failed; production HOLD',
    'run_stage privacy_four_emulators 900s npx --no-install firebase --project "$PROJECT" emulators:exec',
    '--only auth,firestore,functions,storage',
    'node tests/integration/life-movie-jobs-native-transport.emulator.mjs && node tests/integration/life-movie-review-issuer-firestore.emulator.mjs',
    'productionGrant=false render=false',
  ]) assert.ok(runner.includes(command), 'required native acceptance contract missing: ' + command);
  for (const marker of ['URAI_PRIVACY_NATIVE_STAGE_FAIL', 'URAI_PRIVACY_NATIVE_STAGE_PASS']) {
    assert.ok(runner.includes(marker), 'missing original stage evidence marker ' + marker);
  }
  for (const stage of [
    'static_source_pin', 'privacy_frozen_install', 'privacy_functions_frozen_install',
    'privacy_typecheck', 'privacy_build', 'jobs_frozen_install',
    'jobs_original_status_regression', 'jobs_shared_build', 'jobs_functions_build', 'privacy_four_emulators',
  ]) assert.ok(runner.includes('run_stage ' + stage + ' '), 'missing mandatory original stage: ' + stage);
  assert.match(runner, /node --test scripts\/life-movies-owner-tenant-transaction\.test\.mjs/,
    'original source-bound Jobs status regression must execute before native callable acceptance');
  assert.ok(runner.indexOf('run_stage jobs_frozen_install ') <
    runner.indexOf('run_stage jobs_original_status_regression '));
  assert.ok(runner.indexOf('run_stage jobs_original_status_regression ') <
    runner.indexOf('run_stage privacy_four_emulators '));
  assert.doesNotMatch(runner, /firebase deploy|gcloud storage|productionGrant=true|render=true/);
});
