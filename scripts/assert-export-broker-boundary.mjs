#!/usr/bin/env node
/**
 * Source-only release safety tripwire. This is not a production certification.
 * An R841-era Storage signed URL cannot be recalled when a grant is revoked.
 * The stronger PR #160 broker must be integrated with current C6/Jobs source
 * and independently tested before this guard is permitted to pass.
 *
 * No environment variable, CLI flag or test-only bypass grants an exception.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const files = Object.freeze({
  lifecycle: 'functions/src/export-lifecycle-functions.ts',
  entry: 'functions/src/functions-entry.ts',
  actor: 'functions/src/privacy-actor-guard.ts',
  consent: 'functions/src/consent-api.ts',
  processor: 'functions/src/export-request.ts',
  storage: 'storage.rules',
  ui: 'app/privacy-center/export/page.tsx',
  client: 'src/lib/export-download-client.ts',
  callableClient: 'src/lib/firebase-privacy-client.ts',
});

export function evaluateExportBrokerBoundary(source = {}) {
  const missing = [];
  for (const [key, value] of Object.entries(files)) {
    if (typeof source[key] !== 'string' || source[key].trim() === '') missing.push(`missing:${value}`);
  }
  const { lifecycle = '', entry = '', actor = '', consent = '', processor = '', storage = '', ui = '', client = '', callableClient = '' } = source;
  const failures = [...missing];
  const check = (name, passed) => { if (!passed) failures.push(name); };

  check('LEGACY_GCS_SIGNED_URL_FORBIDDEN', !/\bgetSignedUrl\s*\(/.test(lifecycle));
  check('AUTHENTICATED_BROKER_HANDLER_REQUIRED', /export\s+const\s+downloadExportPackage\s*=\s*onRequest\s*\(/.test(lifecycle));
  check('AUTH_REQUIRED_IN_DESCRIPTOR', /requiresAuthorization\s*:\s*true\b/.test(lifecycle));
  check('SOURCE_BOUND_CONSENT_AUTHORITY_REQUIRED', /readExportDownloadAuthority\s*\(/.test(lifecycle) && /consentReceiptHash/.test(lifecycle));
  check('REVALIDATION_PER_64K_CHUNK_REQUIRED', /offset\s*\+=\s*64\s*\*\s*1024/.test(lifecycle) &&
    /readExportDownloadAuthority\s*\(transaction,\s*currentAuth,\s*jobId,\s*file\)/.test(lifecycle));
  check('CURRENT_TOKEN_RECHECK_REQUIRED', /verifyIdToken\(bearer,\s*true\)/.test(lifecycle) && /verifyIdToken\(bearer,\s*true\)/.test(actor));
  check('CURRENT_ACCOUNT_RECHECK_REQUIRED', /getUser\(uid\)/.test(actor) && /account\.disabled/.test(actor));
  check('SIGNED_AND_CURRENT_ADMIN_CLAIMS_REQUIRED', /signedAdmin/.test(actor) && /claims\.admin/.test(actor));
  check('CANONICAL_C7_PROJECTION_REQUIRED', /exportConsentReceiptHash/.test(consent) && /exportConsentStatus/.test(consent));
  check('EXPORT_PROCESSOR_CURRENT_CONSENT_REQUIRED', /evaluateConsentDecision/.test(processor) && /actor\.requireCurrent\(/.test(processor));
  check('BROKER_EXPORTED_FROM_DEPLOYABLE_ENTRY', /export\s*\{[^}]*\bdownloadExportPackage\b[^}]*\}\s*from\s*["']\.\/export-lifecycle-functions["']/.test(entry));
  check('DIRECT_STORAGE_EXPORT_READ_AND_WRITE_DENIAL',
    /match\s*\/exports\/\{uid\}\/\{allPaths=\*\*\}\s*\{\s*allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;\s*\}/.test(storage) &&
    (storage.match(/match\s*\/exports\//g) || []).length === 1);
  check('UI_MUST_USE_BROKER_NOT_OPEN_BEARER_URL', /\bdownloadExportPackage\b/.test(ui) && !/\bwindow\.open\s*\(/.test(ui));
  check('CLIENT_BOUND_BEARER_AND_NO_REDIRECT', /Authorization\s*:\s*`Bearer\s+\$\{token\}`/.test(client) && /redirect\s*:\s*["']error["']/.test(client));
  check('CLIENT_MUST_INVOKE_AUTHENTICATED_TRANSPORT', /fetchAuthorizedExport/.test(callableClient));

  return Object.freeze({ pass: failures.length === 0, failures: Object.freeze(failures) });
}

export function inspectExportBrokerBoundary(root) {
  const source = {};
  for (const [key, relative] of Object.entries(files)) {
    try { source[key] = readFileSync(join(root, relative), 'utf8'); }
    catch { source[key] = ''; }
  }
  return evaluateExportBrokerBoundary(source);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = inspectExportBrokerBoundary(root);
  if (!result.pass) {
    for (const failure of result.failures) console.error(`[export-broker-admission] BLOCKED: ${failure}`);
    console.error('[export-broker-admission] Source shape alone is not live consent or IAM acceptance. HOLD.');
    process.exitCode = 1;
  } else {
    console.log('[export-broker-admission] Source-shape prerequisite PASS; signed consent, real IAM and playback still require independent proof.');
  }
}
