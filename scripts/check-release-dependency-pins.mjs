/**
 * R709 / review-only: deterministic lockfile admission for security-fixed
 * Next.js and Zod. This does not replace npm audit or runtime tests.
 * Every dependency tree (including nested vulnerable copies) must be checked.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REVIEW_MINIMUMS = Object.freeze({
  next: '16.4.5', // November 3, 2026 security update; GHSA-2464-fhr4-w9xw and follow-ups
  zod: '4.6.6',  // GHSA-mrhx-c7xc-m3w5; there is no patched Zod 3.x
});

function numericVersion(value) {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) return null;
  const components = value.split('.').map(Number);
  return components.every(Number.isSafeInteger) ? components : null;
}

function atLeast(actual, minimum) {
  const a = numericVersion(actual);
  const b = numericVersion(minimum);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function reviewReleaseDependencyPins(root = process.cwd()) {
  const failures = [];
  const observed = [];

  for (const relative of ['', 'functions']) {
    const scope = relative || 'root';
    const directory = resolve(root, relative);
    let manifest;
    let lock;
    try {
      manifest = readJson(resolve(directory, 'package.json'));
      lock = readJson(resolve(directory, 'package-lock.json'));
    } catch (error) {
      failures.push(`${scope}: missing or unreadable package manifest / lockfile: ${error.code ?? 'invalid JSON'}`);
      continue;
    }
    const packages = lock?.packages;
    if (lock?.lockfileVersion !== 3 || !packages || typeof packages !== 'object' ||
        !packages[''] || typeof packages[''] !== 'object') {
      failures.push(`${scope}: expected npm lockfile v3 with root package metadata`);
      continue;
    }
    if (!manifest.dependencies || typeof manifest.dependencies !== 'object' ||
        !packages[''].dependencies || typeof packages[''].dependencies !== 'object') {
      failures.push(`${scope}: missing direct dependency inventory`);
      continue;
    }
    const required = relative ? ['zod'] : ['next', 'zod'];
    for (const dependency of required) {
      const declared = manifest.dependencies[dependency];
      const lockedDeclaration = packages[''].dependencies[dependency];
      if (typeof declared !== 'string' || declared !== lockedDeclaration) {
        failures.push(`${scope}: ${dependency} manifest and lock declarations differ or are absent`);
      }
      const installed = packages[`node_modules/${dependency}`]?.version;
      observed.push({ scope, path: `node_modules/${dependency}`, installed });
      if (!atLeast(installed, REVIEW_MINIMUMS[dependency])) {
        failures.push(`${scope}: ${dependency} ${installed ?? 'missing'} is below security floor ${REVIEW_MINIMUMS[dependency]}`);
      }
    }
    // Even a patched direct dependency is not evidence of a clean tree if a
    // nested copy still resolves to an affected version.
    for (const [path, info] of Object.entries(packages)) {
      const match = path.match(/(?:^|\/)node_modules\/(next|zod)$/);
      if (!match || !path.includes('/node_modules/')) continue;
      const packageName = match[1];
      const version = info?.version;
      observed.push({scope, path, installed:version});
      if (!atLeast(version, REVIEW_MINIMUMS[packageName])) {
        failures.push(`${scope}: nested ${path} ${version ?? 'missing'} is below security floor ${REVIEW_MINIMUMS[packageName]}`);
      }
    }
  }
  return Object.freeze({pass:failures.length === 0,failures,observed});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = reviewReleaseDependencyPins(process.cwd());
  for (const failure of result.failures) console.error(`[dependency-pins] DENIED: ${failure}`);
  if (!result.pass) {
    console.error(g[dependency-pins] Critical security floors fail. Do not bypass npm audit or promote this build.');
    process.exitCode = 1;
  } else console.log('[dependency-pins] Security floors pass. Continue complete npm audit and original acceptance.');
}
