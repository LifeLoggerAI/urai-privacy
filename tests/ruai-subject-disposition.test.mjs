import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DELETION_ADAPTERS,
  DELETION_MANIFEST_VERSION,
  deletionSubjectHash,
  deletionAdapterSummary,
  deletionExecutionBlockers,
  canExecuteDeletion,
} from '../functions/src/deletion-contract.ts';

function manifest() {
  return {
    version: DELETION_MANIFEST_VERSION,
    subjectHash: deletionSubjectHash('synthetic-subject'),
    requestId: 'synthetic-request',
    legalHold: false,
    adapters: DELETION_ADAPTERS.map(a => ({adapterId: a.id,system:a.system,status:a.status,itemCount:a.status === 'active' ? 0 : null})),
  };
}

test('RuAi is an explicitly registered pending consumer-data disposition contributor', () => {
  const b2b = DELETION_ADAPTERS.filter(x => x.id === 'ruai-b2bportal');
  assert.equal(b2b.length, 1);
  assert.equal(b2b[0].status, 'pending');
  assert.equal(b2b[0].system, 'ruai-b2bportal');
  assert.equal(b2b[0].schemaVersion, '1.0.0');
  assert.deepEqual(b2b[0].operations, ['subject_linkage_review','tenant_access_withdrawal','central_analytics_retraction','disposition_receipt']);
  assert.equal(b2b[0].reason,'RUAi_CONSUMER_DATA_DISPOSITION_AND_RETRACTION_STAGING_E2E_REQUIRED');
});

test('RuAi pending state is visible in the runtime readiness summary', () => {
  const summary=deletionAdapterSummary();
  assert.equal(summary.executableCrossSystemDelete, false);
  assert.ok(summary.pendingAdapters.some(x=>x.id==='ruai-b2bportal'&&x.system==='ruai-b2bportal'));
});

test('missing B2B contributor cannot disappear from cross-system completion', () => {
  const m=manifest();
  m.adapters=m.adapters.filter(x=>x.adapterId!=='ruai-b2bportal');
  assert.equal(canExecuteDeletion(m), false);
  assert.ok(deletionExecutionBlockers(m).includes('ADAPTER_REGISTRY_MISMATCH'));
});

test('forged RuAi active acknowledgement cannot authorize deletion', () => {
  const m=manifest();
  const index=m.adapters.findIndex(x=>x.adapterId==='ruai-b2bportal');
  assert.ok(index>=0);
  m.adapters[index]={...m.adapters[index],status:'active'};
  assert.equal(canExecuteDeletion(m), false);
  assert.ok(deletionExecutionBlockers(m).includes('ADAPTER_REGISTRY_MISMATCH'));
});

test('source contract version is advanced for additional required contributor', () => {
  assert.equal(DELETION_MANIFEST_VERSION,'1.9.0');
});
