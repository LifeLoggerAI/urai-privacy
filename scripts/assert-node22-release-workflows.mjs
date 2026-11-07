#!/usr/bin/env node
/** Source-only CI runtime check, not hosted CI or deployment certification. */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const expectedWorkflows = Object.freeze({
  '.github/workflows/consent-decision-branch-validation.yml': 2,
  '.github/workflows/dependency-remediation-candidate.yml': 1,
  '.github/workflows/privacy-release-verification.yml': 1,
  '.github/workflows/release-verification.yml': 1,
  '.github/workflows/release-verify.yml': 1,
  '.github/workflows/urai-production-verify.yml': 1
});

export function checkNode22ReleaseWorkflows({ workflows = {}, functionsManifest = '', releaseScript = '' } = {}) {
  const failures = [];
  let manifest;
  try { manifest = JSON.parse(functionsManifest); } catch { manifest = null; }
  if (manifest?.engines?.node !== '22') failures.push('functions_node22_engine_required');
  if (!/node\s+--experimental-strip-types\s+--test\s+tests\/deletion-document-version\.test\.mjs/.test(releaseScript)) {
    failures.push('node22_tests_required');
  }
  for (const [path, count] of Object.entries(expectedWorkflows)) {
    const source = workflows[path];
    if (typeof source !== 'string' || source.trim().length === 0) {
      failures.push('missing_workflow:' + path);
      continue;
    }
    if (!/actions\/setup-node@/.test(source)) failures.push('missing_setup_node:' + path);
    const declared = [...source.matchAll(/^\s*node-version\s*:\s*['"]?([^'"\s#]+)['"]?\s*(?:#.*)?$/gm)]
      .map(match => match[1]);
    if (declared.length !== count || declared.some(version => version !== '22.16.0')) {
      failures.push('invalid_node_version:' + path);
    }
  }
  return Object.freeze({ pass: failures.length === 0, failures: Object.freeze(failures) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (p) => { try { return readFileSync(join(root, p), 'utf8'); } catch { return ''; } };
  const workflows = Object.fromEntries(Object.keys(expectedWorkflows).map(p => [p, read(p)]));
  const result = checkNode22ReleaseWorkflows({ workflows,
    functionsManifest: read('functions/package.json'),
    releaseScript: read('scripts/verify-release.sh') });
  if (!result.pass) {
    for (const reason of result.failures) console.error('[node22-release-gate] BLOCKED: ' + reason);
    process.exitCode = 1;
  } else console.log('[node22-release-gate] Source runtime alignment PASS; hosted CI still required.');
}
