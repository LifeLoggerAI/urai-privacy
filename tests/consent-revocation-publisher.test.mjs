import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const source = readFileSync(new URL('../functions/src/consent-revocation.ts', import.meta.url), 'utf8');
const selector = readFileSync(new URL('../functions/src/consent-revocation-transition.ts', import.meta.url), 'utf8');
const selectorCode = ts.transpileModule(selector, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const selection = {};
vm.runInNewContext(selectorCode, { exports: selection, require, Object, Reflect, RegExp });
const sf = ts.createSourceFile('consent-revocation.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
let expression = '';
for (const stmt of sf.statements) if (ts.isVariableStatement(stmt))
  for (const decl of stmt.declarationList.declarations)
    if (decl.name.getText(sf) === 'publishConsentRevocation') expression = decl.initializer.getText(sf);
assert.ok(expression.startsWith('onDocumentWritten('), 'must execute publisher callback from real source');
const compiled = ts.transpileModule('exports.publish = ' + expression + ';',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.length, 0);

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const grant = { uid: 'synthetic-owner', purpose: 'memory.storage', consentTier: 'C1',
  policyVersion: '1.0.0', status: 'granted', receiptHash: 'a'.repeat(64) };
const revoke = { ...grant, status: 'revoked', receiptHash: 'b'.repeat(64) };
const event = (before, after) => ({ params: { recordId: 'synthetic-owner_memory_storage' },
  data: { before: { exists: !!before, data: () => before }, after: { exists: !!after, data: () => after } } });

function fixture() {
  const records = new Map();
  let writes = 0;
  const db = { collection(name) {
    assert.equal(name, 'consentRevocationOutbox');
    return { doc: id => ({ id }) };
  }, async runTransaction(callback) {
    const pending = [];
    const tx = {
      async get(ref) { return { exists: records.has(ref.id), data: () => records.get(ref.id) }; },
      create(ref, data) { pending.push({ ref, data }); },
    };
    await callback(tx);
    for (const entry of pending) {
      assert.equal(records.has(entry.ref.id), false, 'duplicate create');
      records.set(entry.ref.id, entry.data);
      writes += 1;
    }
  } };
  const exports = {};
  const sentinel = Symbol.for('SERVER_TIMESTAMP');
  vm.runInNewContext(compiled.outputText, { exports, db, digest,
    REVOCATION_SCHEMA_VERSION: 'consent.revoked.v1',
    FieldValue: { serverTimestamp: () => sentinel },
    selectConsentRevocationSource: selection.selectConsentRevocationSource,
    onDocumentWritten(pattern, callback) {
      assert.equal(pattern, 'consentRecords/{recordId}');
      return callback;
    }, Object, RegExp, String, Error });
  return { publish: exports.publish, records, get writes() { return writes; }, sentinel };
}

test('revocation creates exactly one scheduled, pending Jobs obligation', async () => {
  const h = fixture();
  await h.publish(event(grant, revoke));
  assert.equal(h.writes, 1);
  const [id, row] = [...h.records.entries()][0];
  assert.equal(id, row.eventId);
  assert.equal(row.jobsDeliveryConsumerId, 'urai-jobs');
  assert.equal(row.jobsDeliveryState, 'pending');
  assert.equal(row.jobsDeliveryAttempts, 0);
  assert.equal(row.jobsNextAttemptAt, h.sentinel);
  assert.equal(row.createdAt, h.sentinel);
  assert.equal(row.status, 'pending');
  assert.equal(row.sourceReceiptHash, revoke.receiptHash);
  assert.equal(row.integrityHash, digest({ eventId: id, recordId: row.consentRecordId,
    uid: row.uid, purpose: row.purpose }));
});

test('trigger replay cannot reset delivery attempts or pending retries', async () => {
  const h = fixture();
  await h.publish(event(grant, revoke));
  const row = [...h.records.values()][0];
  row.jobsDeliveryState = 'retry';
  row.jobsDeliveryAttempts = 3;
  await h.publish(event(grant, revoke));
  assert.equal(h.writes, 1);
  assert.equal(row.jobsDeliveryState, 'retry');
  assert.equal(row.jobsDeliveryAttempts, 3);
});

test('same-owner grant renewal emits no revocation obligation', async () => {
  const h = fixture();
  await h.publish(event(grant, { ...grant, receiptHash: 'c'.repeat(64) }));
  assert.equal(h.writes, 0);
});

test('malformed replacement retains last valid grant owner for revocation', async () => {
  const h = fixture();
  await h.publish(event(grant, { ...revoke, uid: 'other-owner' }));
  assert.equal(h.writes, 1);
  const row = [...h.records.values()][0];
  assert.equal(row.uid, grant.uid);
  assert.equal(row.jobsDeliveryState, 'pending');
});

test('initial grant does not emit revocation obligation', async () => {
  const h = fixture();
  await h.publish(event(null, grant));
  assert.equal(h.writes, 0);
});
