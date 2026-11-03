import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const source = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
const sf = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
let expression = '';
for (const stmt of sf.statements) if (ts.isVariableStatement(stmt))
  for (const decl of stmt.declarationList.declarations)
    if (decl.name.getText(sf) === 'getPrivacyHealthReport') expression = decl.initializer.getText(sf);
assert.ok(expression.startsWith('onCall('), 'must execute actual Privacy health callable callback');
const compiled = ts.transpileModule('exports.health = ' + expression + ';',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.length, 0);

function fixture({ exportsOpen = 0, deletionsOpen = 0, revocations = [] } = {}) {
  const sizes = { privacyRequests: exportsOpen, deletionRequests: deletionsOpen,
    retentionPolicies: 2, auditLogs: 5, consentRevocationOutbox: revocations.length };
  const db = { collection(name) {
    assert.ok(name in sizes, 'unexpected collection: ' + name);
    const query = {
      where() { return this; },
      limit(value) {
        if (name === 'consentRevocationOutbox') assert.equal(value, 101);
        return this;
      },
      async get() {
        return { size: sizes[name], docs: name === 'consentRevocationOutbox'
          ? revocations.map(value => ({ data: () => value })) : [] };
      },
    };
    return query;
  } };
  const exports = {};
  vm.runInNewContext(compiled.outputText, { exports, db, Date, Promise,
    onCall: callback => callback,
    requireAdmin: async request => {
      if (request?.verifiedAdmin !== true) throw new Error('ADMIN_REQUIRED');
    } });
  return exports.health;
}

test('clean sampled outbox can be nominal, but never certified', async () => {
  const health = fixture({ revocations: [{ jobsDeliveryState: 'applied' }] });
  const result = await health({ verifiedAdmin: true });
  assert.equal(result.operationalState, 'nominal');
  assert.equal(result.certification, 'not_certified');
  assert.equal(result.verdict, 'evidence_incomplete');
  assert.equal(result.jobsRevocationUnresolvedSampled, 0);
  assert.equal(result.jobsRevocationRecordsSampled, 1);
});

for (const state of ['pending', 'retry', 'leased', 'needs-review', 'unknown', null, undefined]) {
  test('outstanding or malformed Jobs state is never reported nominal: ' + String(state), async () => {
    const result = await fixture({ revocations: [{ jobsDeliveryState: state }] })({ verifiedAdmin: true });
    assert.equal(result.operationalState, 'needs_review');
    assert.equal(result.jobsRevocationUnresolvedSampled, 1);
  });
}

test('legacy outbox without Jobs scheduling fields requires review', async () => {
  const result = await fixture({ revocations: [{}] })({ verifiedAdmin: true });
  assert.equal(result.operationalState, 'needs_review');
  assert.equal(result.jobsRevocationUnresolvedSampled, 1);
});

test('101 sampled records is an incomplete census even when all are applied', async () => {
  const result = await fixture({ revocations: Array.from({ length: 101 }, () => ({ jobsDeliveryState: 'applied' })) })({ verifiedAdmin: true });
  assert.equal(result.operationalState, 'needs_review');
  assert.equal(result.revocationSampleIncomplete, true);
  assert.equal(result.jobsRevocationRecordsSampled, 101);
});

test('export and deletion thresholds still elevate health', async () => {
  for (const options of [{ exportsOpen: 51 }, { deletionsOpen: 26 }]) {
    const result = await fixture(options)({ verifiedAdmin: true });
    assert.equal(result.operationalState, 'needs_review');
  }
});

test('health evidence is accessible only after the preexisting admin check', async () => {
  await assert.rejects(fixture()({ verifiedAdmin: false }), /ADMIN_REQUIRED/);
});
