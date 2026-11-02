#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * PRIVATE, LOCAL EXACT-HEAD ACCEPTANCE RUNNER. NOT A PRODUCTION RELEASE TOOL.
 * Every command below is an original Privacy repository command. It does not
 * deploy, issue consent, create provider resources or bypass GitHub CI/review.
 * Run only inside a checked-out, clean LifeLoggerAI/urai-privacy candidate.
 */
export const REPO = 'LifeLoggerAI/urai-privacy';
export const EMULATOR_PROJECT = 'urai-privacy-integration-test';
export const SHA40 = /^[0-9a-f]{40}$/;
export const COMMANDS = Object.freeze([
  ['root-install', 'npm', ['ci']],
  ['functions-install', 'npm', ['ci', '--prefix', 'functions']],
  ['lint', 'npm', ['run', 'lint']],
  ['root-types', 'npm', ['run', 'typecheck']],
  ['original-unit', 'npm', ['run', 'test:unit']],
  ['static-rules', 'npm', ['run', 'test:rules:static']],
  ['export-contract', 'npm', ['run', 'test:export:contract']],
  ['deletion-contract', 'npm', ['run', 'test:deletion:contract']],
  ['route-smoke', 'npm', ['run', 'test:e2e']],
  ['functions-types', 'npm', ['--prefix', 'functions', 'run', 'typecheck']],
  ['functions-build', 'npm', ['--prefix', 'functions', 'run', 'build']],
  ['next-build', 'npm', ['run', 'build']],
  ['security-gate', 'npm', ['run', 'security:gate']],
  ['firebase-emulators', 'npm', ['run', 'test:emulators']]
].map(([id, command, args]) => Object.freeze({id, command, args: Object.freeze(args)})));

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const RELEASE_DENIED = 'NO-GO';
const schema = 'urai.privacy.local-exact-head-acceptance.v1';
const safeEnvironment = () => {
  // Do not pass provider credentials or cloud project overrides to npm scripts.
  const allowed = [
    'PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'SYSTEMROOT',
    'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'COMSPEC', 'PATHEXT',
    'LANG', 'LC_ALL', 'TZ', 'TERM', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
    'http_proxy', 'https_proxy', 'no_proxy', 'ProgramFiles', 'ProgramFiles(x86)',
    'PROGRAMDATA', 'USERDOMAIN', 'HOMEDRIVE', 'HOMEPATH'
  ];
  const env = Object.fromEntries(allowed.filter(k => Object.hasOwn(process.env, k))
    .map(k => [k, process.env[k]]));
  return {...env, CI: '1', URAI_RELEASE_VERIFY: '1', GCLOUD_PROJECT: EMULATOR_PROJECT};
};
const textHash = (contents) => createHash('sha256').update(contents).digest('hex');
const shaFile = (p) => textHash(readFileSync(p));
const asCommand = (item) => [item.command, ...item.args].join(' ');

export function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === '--plan') return {plan: true};
  if (argv.length !== 2 || argv[0] !== '--expected-sha' || !SHA40.test(argv[1])) {
    throw new Error('Usage: node scripts/run-privacy-exact-head.mjs --expected-sha <40-character Git commit SHA> (or --plan)');
  }
  return {plan: false, expectedSha: argv[1]};
}

export function assertCandidate({expectedSha, observedSha, origin, gitRoot, expectedRoot, status}) {
  assert.ok(SHA40.test(expectedSha), 'Expected SHA must be immutable 40-character hex');
  assert.equal(observedSha, expectedSha, 'Checkout HEAD must equal pinned expected SHA');
  assert.match(origin.trim(), /(?:github\.com|ssh\.github\.com)[:/]LifeLoggerAI\/urai-privacy(?:\.git)?$/i,
    'origin must be the owned LifeLoggerAI/urai-privacy repository');
  const normalize = p => process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);
  assert.equal(normalize(gitRoot), normalize(expectedRoot), 'Run at repository root');
  assert.equal(status.trim(), '', 'Repository must be clean before running original tests');
}

export function isCompleteLocalEvidence(report) {
  return Boolean(report && report.schemaVersion === schema && report.repository === REPO &&
    report.releaseVerdict === RELEASE_DENIED && report.productionAllowed === false &&
    report.cloudDeploymentPerformed === false && report.independentApprovalObtained === false &&
    report.status === 'PASS_LOCAL_ONLY' && SHA40.test(report.sourceSha ?? '') &&
    SHA40.test(report.treeSha ?? '') && report.cleanAtStart === true && report.cleanAtEnd === true &&
    report.emulatorProject === EMULATOR_PROJECT && Array.isArray(report.commands) &&
    report.commands.length === COMMANDS.length &&
    report.commands.every((entry, i) => entry?.id === COMMANDS[i].id &&
      entry?.command === asCommand(COMMANDS[i]) && entry?.status === 'passed' &&
      entry?.exitCode === 0 && typeof entry.logSha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(entry.logSha256)));
}

function capture(command, args, cwd = ROOT, opts = {}) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', shell: false,
    timeout: opts.timeout ?? 20_000, env: safeEnvironment(), maxBuffer: 1024 * 1024});
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr?.slice(0, 450) ?? result.status}`);
  }
  return (result.stdout ?? result.stderr ?? '').trim();
}
function noSourceChanges() {
  return capture('git', ['status', '--porcelain', '--untracked-files=no'], ROOT) === '';
}
function runOriginal(item, logFile) {
  const fd = openSync(logFile, 'w', 0o600);
  const started = Date.now();
  let result;
  try {
    result = spawnSync(item.command, item.args, {
      cwd: ROOT, env: safeEnvironment(), timeout: 18 * 60_000,
      shell: process.platform === 'win32', stdio: ['ignore', fd, fd],
      windowsHide: true
    });
  } finally {
    closeSync(fd);
  }
  const exitCode = result.status ?? 1;
  return {id: item.id, command: asCommand(item), status: exitCode === 0 && !result.error ? 'passed' : 'failed',
    exitCode, durationMs: Date.now() - started, logFile: basename(logFile), logSha256: shaFile(logFile),
    error: result.error?.code ?? null};
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.plan) {
    console.log(JSON.stringify({status:'NOT_RUN',releaseVerdict:RELEASE_DENIED,
      commands:COMMANDS.map(asCommand),emulatorProject:EMULATOR_PROJECT},null,2));
    return;
  }
  const outputDir = mkdtempSync(join(tmpdir(), 'urai-privacy-exact-head-'));
  const reportFile = join(outputDir, 'report.json');
  const report = {
    schemaVersion:schema,repository:REPO,sourceSha:args.expectedSha,treeSha:null,
    observedAt:new Date().toISOString(),emulatorProject:EMULATOR_PROJECT,
    runtimeNode:process.version,runtimeJava:null,cleanAtStart:false,cleanAtEnd:false,
    productionAllowed:false,cloudDeploymentPerformed:false,independentApprovalObtained:false,
    releaseVerdict:RELEASE_DENIED,status:'BLOCKED',commands:[],fatal:null
  };
  const flush = () => writeFileSync(reportFile, JSON.stringify(report,null,2) + '\n', {mode:0o600});
  try {
    const head = capture('git', ['rev-parse', '--verify', 'HEAD']);
    const tree = capture('git', ['rev-parse', '--verify', 'HEAD^{tree}']);
    const origin = capture('git', ['remote', 'get-url', 'origin']);
    const gitRoot = capture('git', ['rev-parse', '--show-toplevel']);
    const status = capture('git', ['status', '--porcelain', '--untracked-files=all']);
    assertCandidate({expectedSha:args.expectedSha,observedSha:head,origin,gitRoot,expectedRoot:ROOT,status});
    report.treeSha = tree;
    report.cleanAtStart = true;
    for (const required of ['package-lock.json','functions/package-lock.json','firebase.emulators.json']) {
      assert.ok(existsSync(join(ROOT,required)), `Missing original ${required}`);
    }
    report.packageLockSha256 = shaFile(join(ROOT,'package-lock.json'));
    report.functionsLockSha256 = shaFile(join(ROOT,'functions/package-lock.json'));
    const major = Number(process.versions.node.split('.')[0]);
    assert.ok(major === 20 || major === 22, 'Use the reviewed Node 20 or 22 release line');
    const java = spawnSync('java', ['-version'], {cwd:ROOT,encoding:'utf8',timeout:20_000,env:safeEnvironment()});
    assert.equal(java.status,0,'Java 21 is required for Firebase emulator tests');
    const version = (java.stderr ?? java.stdout ?? '').match(/version\s+"(\d+)/)?.[1];
    assert.ok(Number(version) >= 21, 'Java 21 or higher is required');
    report.runtimeJava = (java.stderr ?? java.stdout).split('\n')[0];
    flush();
    for (const item of COMMANDS) {
      const log = join(outputDir,`${String(report.commands.length+1).padStart(2,'0')}-${item.id}.log`);
      console.log(`RUN ${item.id}: ${asCommand(item)}`);
      const result = runOriginal(item,log);
      report.commands.push(result);
      flush();
      console.log(`${result.status.toUpperCase()} ${item.id} (${result.durationMs}ms)`);
      if (result.status !== 'passed') throw new Error(`Original command failed: ${item.id} (see ${result.logFile})`);
    }
    report.cleanAtEnd = noSourceChanges();
    assert.equal(report.cleanAtEnd,true,'Tracked source changed during verification');
    report.status = 'PASS_LOCAL_ONLY';
    assert.ok(isCompleteLocalEvidence(report),'Incomplete report cannot be marked passed');
  } catch (err) {
    report.status = 'BLOCKED';
    report.fatal = err instanceof Error ? err.message : String(err);
    console.error(`HOLD: ${report.fatal}`);
    process.exitCode = 1;
  } finally {
    flush();
    console.log(`Evidence (private local, NOT release approval): ${reportFile}`);
    console.log(`Release verdict: ${RELEASE_DENIED}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {console.error(err); process.exitCode = 1;});
}
