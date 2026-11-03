import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../functions/src/consent-revocation-jobs-dispatcher.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { fileName: 'dispatcher.ts', reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
assert.equal(compiled.diagnostics?.length ?? 0, 0);
const DELETED = Symbol('deleted'), NOW = 1793685600000, ID = 'a'.repeat(64);
const FieldValue = { delete: () => DELETED, serverTimestamp: () => 'server-time' };
class Timestamp {
  constructor(ms) { this.ms = ms; }
  toMillis() { return this.ms; }
  static fromMillis(ms) { return new Timestamp(ms); }
}
const endpoint = 'https://us-central1-urai-jobs.cloudfunctions.net/ingestConsentRevocation';
const transport = (overrides = {}) => ({ endpoint, expectedHost: 'us-central1-urai-jobs.cloudfunctions.net',
  bearerToken: 'x'.repeat(64), ...overrides });
let response, database, transmissions;
const fixture = (overrides = {}) => {
  const row = { eventId: ID, schemaVersion: 'consent.revoked.v1', status: 'pending',
    consentRecordId:'owner-1_memory_storage', uid:'owner-1',purpose:'memory.storage',
    jobsDeliveryConsumerId: 'urai-jobs', jobsDeliveryState: 'pending', jobsDeliveryAttempts: 0,
    jobsNextAttemptAt: Timestamp.fromMillis(NOW), ...overrides };
  transmissions = 0;
  const writes = [];
  database = {
    collection(name) {
      if(name==='consentRecords')return {doc:(id)=>({id,kind:'canonical'})};
      assert.equal(name, 'consentRevocationOutbox');
      const parts = [];
      const q = {
        where(...x) { parts.push(x); return q; },
        orderBy(...x) { parts.push(x); return q; },
        limit(n) { assert.ok(n > 0 && n <= 20); return q; },
        async get() { return { docs: row.jobsNextAttemptAt instanceof Timestamp &&
          row.jobsNextAttemptAt.toMillis() <= NOW && ['pending', 'retry', 'leased'].includes(row.jobsDeliveryState)
          ? [{id: ID, ref: {id: ID}}] : [] }; },
      };
      return q;
    },
    async runTransaction(work) {
      const pending = [];
      const tx = { get: async (ref) => ref.kind==='canonical'
        ? ({exists:true,data:()=>({uid:'owner-1',purpose:'memory.storage',status:'revoked',receiptHash:'a'.repeat(64)}),updateTime:Timestamp.fromMillis(123)})
        : ({ exists: true, data: () => ({...row}) }),
        update: (_,patch) => pending.push(patch) };
      const result = await work(tx);
      for (const patch of pending) { for(const [key,value] of Object.entries(patch)) {
        if(value===DELETED) delete row[key]; else row[key] = value;
      } writes.push({...patch}); }
      return result;
    },
  };
  return {row,writes};
};
const module = { exports: {} };
vm.runInNewContext(compiled.outputText, { module, exports: module.exports, URL, Date, Number, Object,
  Error, Set, RegExp, Promise, require: name => {
    if(name==='node:crypto') return { randomUUID: () => 'lease-id' };
    if(name==='firebase-admin/firestore') return { FieldValue, Timestamp, getFirestore: () => database };
    if(name==='./consent-revocation-jobs-contract') return {
      buildJobsRevocationEventV2: (id,data) => {
        if(data.status!=='pending' || data.schemaVersion!=='consent.revoked.v1')throw Error('invalid source');
        return {eventId:id,ownerUid:'owner-1',purpose:'memory.storage'};
      },
      sendJobsRevocationEvent: async event => {
        transmissions++;
        if(response instanceof Error) throw response;
        if(typeof response==='function') return response();
        return response ?? {eventId:event.eventId,consumerId:'urai-jobs',acknowledgementHash:'f'.repeat(64)};
      },
    };
    throw Error('unexpected module: '+name);
  } });
const run = () => module.exports.dispatchPendingJobsRevocations(transport(), {db:database,now:()=>NOW});

test('verified ack is required before recording applied', async () => {
  const {row} = fixture();response=undefined;
  assert.equal((await run()).applied,1);
  assert.equal(row.jobsDeliveryState,'applied');
  assert.equal(row.jobsDeliveryAckHash,'f'.repeat(64));
  assert.equal('jobsLeaseToken' in row,false);
  assert.equal(transmissions,1);
});
test('timeout is retried with durable attempt and no raw error', async () => {
  const {row} = fixture();response=Error('private provider object path');
  assert.equal((await run()).retry,1);
  assert.equal(row.jobsDeliveryState,'retry');
  assert.equal(row.jobsDeliveryAttempts,1);
  assert.equal(row.jobsNextAttemptAt.toMillis(),NOW+30000);
  assert.equal('jobsDeliveryAckHash' in row,false);
  assert.ok(!JSON.stringify(row).includes('private provider'));
});
test('corrupt source and exhausted retries require review', async () => {
  let {row} = fixture({schemaVersion:'bad'});response=undefined;
  assert.equal((await run()).needsReview,1);
  assert.equal(row.jobsDeliveryState,'needs-review');
  assert.equal(transmissions,0);
  ({row} = fixture({jobsDeliveryAttempts:12}));
  assert.equal((await run()).needsReview,1);
  assert.equal(row.jobsDeliveryState,'needs-review');
  assert.equal(transmissions,0);
});
test('lease stolen after delivery cannot be finalized by old worker', async () => {
  const {row} = fixture();response=() => {
    row.jobsLeaseToken='another-worker';
    return {eventId:ID,consumerId:'urai-jobs',acknowledgementHash:'f'.repeat(64)};
  };
  assert.equal((await run()).skipped,1);
  assert.equal(row.jobsLeaseToken,'another-worker');
  assert.equal(row.jobsDeliveryState,'leased');
});
test('forged acknowledgement identity is never accepted', async () => {
  const {row} = fixture();response={eventId:'b'.repeat(64),consumerId:'urai-jobs',acknowledgementHash:'f'.repeat(64)};
  assert.equal((await run()).retry,1);
  assert.equal(row.jobsDeliveryState,'retry');
});
test('bad token or endpoint never creates a lease', async () => {
  const {writes} = fixture();response=undefined;
  for(const bad of [{bearerToken:''}, {endpoint:'http://us-central1-urai-jobs.cloudfunctions.net/ingestConsentRevocation'},
    {expectedHost:'evil.example'}, {endpoint:endpoint+'?q=1'}]) {
    await assert.rejects(module.exports.dispatchPendingJobsRevocations(transport(bad),{db:database,now:()=>NOW}),
      /PRIVACY_JOBS_DISPATCHER_AUTHORITY_UNAVAILABLE/);
  }
  assert.equal(writes.length,0);
  assert.equal(transmissions,0);
});
