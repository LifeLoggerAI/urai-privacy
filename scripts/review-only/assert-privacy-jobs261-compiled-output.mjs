/**
 * Review-only R558: after attesting the exact Jobs #261 source checkout,
 * compare the ignored JS imported by the Privacy emulator bridge with a fresh
 * TypeScript emit into a separate disposable directory. No cloud or grants.
 * This is an artifact-parity assertion, not a signed production build receipt.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';

const REQUIRED_IMPORTED_JAVASCRIPT = Object.freeze([
  'jobs/studioLifeMovieContract.js',
  'privacy/lifeMovieFirebaseOwnerState.js',
  'privacy/lifeMovieFirebaseSourceRightsAdapter.js',
  'privacy/lifeMovieDerivativeRevocation.js',
]);

function emitFreshJobsTypeScript({ checkout, outputDir }) {
  const functionsDir = join(checkout, 'functions');
  const tsc = join(functionsDir, 'node_modules', 'typescript', 'bin', 'tsc');
  const result = spawnSync(process.execPath,
    [tsc, '--project', 'tsconfig.json', '--outDir', outputDir, '--noEmitOnError'],
    { cwd: functionsDir, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
      env: { ...process.env, CI: '1' }, windowsHide: true });
  assert.equal(result.error, undefined, 'JOBS_FRESH_TSC_EXEC_ERROR');
  assert.equal(result.status, 0,
    'JOBS_FRESH_TSC_EMIT_FAILED: ' + String(result.stderr || result.stdout || '').slice(0, 1200));
}

function emittedJavaScript(root) {
  const files = new Map();
  const visit = (dir) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      assert.ok(!item.isSymbolicLink(), 'JOBS_COMPILED_SYMLINK_NOT_ALLOWED: ' + path);
      if (item.isDirectory()) visit(path);
      else if (item.isFile() && item.name.endsWith('.js')) {
        const name = relative(root, path).split(sep).join('/');
        files.set(name, createHash('sha256').update(readFileSync(path)).digest('hex'));
      }
    }
  };
  visit(root);
  return files;
}

export function assertPrivacyJobs261CompiledOutput({ directory }, { compile = emitFreshJobsTypeScript } = {}) {
  assert.ok(typeof directory === 'string' && isAbsolute(directory), 'JOBS_COMPILED_ABSOLUTE_CHECKOUT_REQUIRED');
  const checkout = realpathSync(directory);
  assert.ok(checkout.startsWith('/tmp' + sep), 'JOBS_COMPILED_DISPOSABLE_CHECKOUT_REQUIRED');
  const libRoot = join(checkout, 'functions', 'lib');
  const originalOutput = join(libRoot, 'functions');
  // Root symlinks are not encountered by the recursive Dirent walker below.
  assert.ok(!lstatSync(libRoot).isSymbolicLink(), 'JOBS_COMPILED_LIB_SYMLINK_NOT_ALLOWED');
  assert.ok(!lstatSync(originalOutput).isSymbolicLink(), 'JOBS_COMPILED_OUTPUT_ROOT_SYMLINK_NOT_ALLOWED');
  const scratch = mkdtempSync(join(tmpdir(), 'urai-r558-jobs-artifact-'));
  try {
    compile({ checkout, outputDir: scratch });
    const compiled = emittedJavaScript(originalOutput);
    const freshlyEmitted = emittedJavaScript(scratch);
    for (const required of REQUIRED_IMPORTED_JAVASCRIPT) {
      assert.ok(compiled.has(required) && freshlyEmitted.has(required),
        'JOBS_REQUIRED_COMPILED_MODULE_MISSING: ' + required);
    }
    assert.ok(freshlyEmitted.size >= REQUIRED_IMPORTED_JAVASCRIPT.length,
      'JOBS_EMPTY_FRESH_TYPESCRIPT_EMIT');
    assert.equal(compiled.size, freshlyEmitted.size,
      'JOBS_COMPILED_JAVASCRIPT_FILESET_MISMATCH');
    for (const [path, freshHash] of freshlyEmitted) {
      assert.ok(compiled.has(path), 'JOBS_COMPILED_JAVASCRIPT_MISSING: ' + path);
      assert.equal(compiled.get(path), freshHash, 'JOBS_COMPILED_JAVASCRIPT_BYTES_MISMATCH: ' + path);
    }
    const sha256 = createHash('sha256').update(
      [...freshlyEmitted].sort(([a], [b]) => a.localeCompare(b))
        .map(([p, hash]) => p + '\0' + hash + '\n').join(''))
      .digest('hex');
    return Object.freeze({ reviewOnly: true, productionAuthorized: false,
      javascriptFileCount: freshlyEmitted.size, emittedFileDigestSha256: sha256 });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
