import test from 'node:test';
import assert from 'node:assert/strict';
import { deletionRequestAdmissionBlockReason, exportRequestAdmissionBlockReason } from '../functions/src/request-admission-policy.ts';

const uid = 'owner-1';
const receipt = 'a'.repeat(64);
const valid = () => ({
  uid, deletionState: false,
  tombstone: {uid, active: false, exportConsentStatus:'granted', exportConsentReceiptHash:receipt,
    exportConsentPolicyVersion:'1.0.0'},
  consent: {uid, purpose:'data.export', consentTier:'C7', status:'granted', policyVersion:'1.0.0', receiptHash:receipt},
  canonicalConsentAllowed:true, consentExpiresAtMillis:200000, projectedExpiresAtMillis:200000, nowMillis:100000
});

test('current owner with canonical granted C7 and matching receipt may create export work', () => {
  assert.equal(exportRequestAdmissionBlockReason(valid()), null);
});

test('deletion right works without a prior consent record or tombstone', () => {
  assert.equal(deletionRequestAdmissionBlockReason({uid, deletionState:false, tombstone:null}), null);
});
function denied(title, patch, code) {
  test(title, () => {const input=valid(); patch(input); assert.equal(exportRequestAdmissionBlockReason(input),code);});
}
denied('inactive but wrong UID tombstone is not clearance', x => {x.tombstone.uid='other'},'malformed_or_foreign_deletion_fence');
denied('stale active deletion blocks export', x => {x.deletionState=true},'subject_deletion_or_planning_fenced');
denied('in-flight deletion planning classification blocks export', x => {x.deletionState=undefined},'subject_deletion_or_planning_fenced');
denied('no projected grant blocks export', x => {x.tombstone=null},'missing_c7_projection');
denied('denied canonical grant blocks export', x => {x.canonicalConsentAllowed=false},'canonical_c7_not_current');
denied('foreign subject canonical record blocks export', x => {x.consent.uid='other'},'canonical_c7_subject_or_policy_mismatch');
denied('incorrect purpose blocks export', x => {x.consent.purpose='life-movie.render'},'canonical_c7_subject_or_policy_mismatch');
denied('wrong consent tier blocks export', x => {x.consent.consentTier='C1'},'canonical_c7_subject_or_policy_mismatch');
denied('stale consent policy blocks export', x => {x.consent.policyVersion='0.1.0'},'canonical_c7_subject_or_policy_mismatch');
denied('missing receipt hash blocks export', x => {delete x.consent.receiptHash},'c7_receipt_projection_mismatch');
denied('mismatched receipt projection blocks export', x => {x.tombstone.exportConsentReceiptHash='b'.repeat(64)},'c7_receipt_projection_mismatch');
denied('stale projection status blocks export', x => {x.tombstone.exportConsentStatus='revoked'},'c7_receipt_projection_mismatch');
denied('untrusted expiry projection blocks export', x => {x.projectedExpiresAtMillis=200001},'c7_expired_or_projection_expiry_mismatch');
denied('expired canonical consent blocks export', x => {x.nowMillis=200000},'c7_expired_or_projection_expiry_mismatch');
denied('malformed timestamp blocks export', x => {x.consentExpiresAtMillis=Number.NaN},'c7_expired_or_projection_expiry_mismatch');
denied('inherited fields cannot manufacture consent', x => {
  x.consent=Object.create({uid, purpose:'data.export', consentTier:'C7', status:'granted',policyVersion:'1.0.0',receiptHash:receipt});
},'canonical_c7_subject_or_policy_mismatch');
denied('accessor cannot manufacture a consent receipt', x => {
  const c={...x.consent};Object.defineProperty(c,'receiptHash',{get(){throw new Error('getter must not run')}});x.consent=c;
},'c7_receipt_projection_mismatch');
test('deletion request denies active or malformed present tombstones', () => {
  assert.equal(deletionRequestAdmissionBlockReason({uid, deletionState:true,tombstone:{uid,active:true}}),'subject_deletion_or_planning_fenced');
  assert.equal(deletionRequestAdmissionBlockReason({uid, deletionState:undefined,tombstone:{uid}}),'subject_deletion_or_planning_fenced');
  assert.equal(deletionRequestAdmissionBlockReason({uid, deletionState:false,tombstone:{uid:'other',active:false}}),'malformed_or_foreign_deletion_fence');
});
test('deletion request denies unscoped subject identifiers', () => {
  assert.equal(deletionRequestAdmissionBlockReason({uid:'../owner-1',deletionState:false,tombstone:null}),'invalid_subject');
});
