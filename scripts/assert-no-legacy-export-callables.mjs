#!/usr/bin/env node
/** Security source tripwire; shape checks are not runtime authorization proof. */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkLegacyExportSurface({ index = '', entry = '', processor = '', broker = '' } = {}) {
  const violations = [];
  const requireShape = (ok, name) => { if (!ok) violations.push(name); };
  requireShape(!/\bgetSignedUrl\s*\(/.test(index), 'legacy_gcs_signed_url');
  requireShape(!/export\s+(?:const|function)\s+getExportDownloadUrl\b/.test(index), 'legacy_export_url_callable');
  requireShape(!/export\s+(?:const|function)\s+processExportRequest\b/.test(index), 'legacy_export_processor');
  requireShape(!/\b(?:processExportSchema|getExportDownloadSchema|EXPORT_SIGNED_URL_TTL_MS)\b/.test(index), 'legacy_export_admission_artifacts');
  requireShape(/export\s+const\s+executeDeletionRequest\s*=\s*onCall/.test(index) && /privacy-deletion-plan-v4/.test(index), 'preserve_versioned_deletion');
  requireShape(/export\s*\{\s*processExportRequest\s*\}\s*from\s*["']\.\/export-request["']/.test(entry), 'canonical_processor_entry');
  requireShape(/export\s*\{[^}]*\bdownloadExportPackage\b[^}]*\}\s*from\s*["']\.\/export-lifecycle-functions["']/.test(entry), 'canonical_broker_entry');
  requireShape(!/export\s*\*\s*from\s*["']\.\/index["']/.test(entry) &&
    !/export\s*\{[^}]*(?:getExportDownloadUrl|processExportRequest)[^}]*\}\s*from\s*["']\.\/index["']/.test(entry), 'legacy_index_export');
  requireShape(/export\s+const\s+processExportRequest\s*=\s*onCall/.test(processor), 'canonical_processor_implementation');
  requireShape(/export\s+const\s+downloadExportPackage\s*=\s*onRequest/.test(broker), 'canonical_broker_implementation');
  requireShape(!/\bgetSignedUrl\s*\(/.test(broker), 'broker_issues_raw_signed_url');
  return Object.freeze({ pass: violations.length === 0, violations: Object.freeze(violations) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (p) => { try { return readFileSync(join(root, p), 'utf8'); } catch { return ''; } };
  const result = checkLegacyExportSurface({
    index: read('functions/src/index.ts'),
    entry: read('functions/src/functions-entry.ts'),
    processor: read('functions/src/export-request.ts'),
    broker: read('functions/src/export-lifecycle-functions.ts')
  });
  if (!result.pass) {
    for (const name of result.violations) console.error('[legacy-export-hardstop] BLOCKED: ' + name);
    process.exitCode = 1;
  } else {
    console.log('[legacy-export-hardstop] Source boundary PASS; real consent and IAM unverified.');
  }
}
