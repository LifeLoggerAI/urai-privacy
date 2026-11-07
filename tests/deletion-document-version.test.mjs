import test from 'node:test';
import assert from 'node:assert/strict';
import { sameDeletionDocumentVersion, deletionDocumentBelongsToSubject } from '../functions/src/deletion-document-version.ts';
const stamp = (seconds=123,nanoseconds=456)=>({seconds,nanoseconds});
test('identical Firestore update time permits continued owner-scoped deletion',()=>{
  assert.equal(sameDeletionDocumentVersion(stamp(),stamp()),true);
});
test('same document ID with replacement updateTime is rejected',()=>{
  assert.equal(sameDeletionDocumentVersion(stamp(),stamp(123,457)),false);
});
test('no unsafe rounding of full-precision update nanoseconds',()=>{
  assert.equal(sameDeletionDocumentVersion(stamp(9007199254740991,999999999),stamp(9007199254740991,999999998)),false);
});
test('malformed timestamp versions never certify approval',()=>{
  for(const value of [null, undefined, {}, {seconds:123}, {seconds:123,nanoseconds:-1}, {seconds:123,nanoseconds:1000000000}, {seconds:1.1,nanoseconds:0},{seconds:Infinity,nanoseconds:0},Object.create({seconds:123,nanoseconds:456})]) {
    assert.equal(sameDeletionDocumentVersion(stamp(),value),false);
  }
});
test('getters cannot inject version authority',()=>{
  const forged={get seconds(){throw new Error('executed getter')},nanoseconds:456};
  assert.equal(sameDeletionDocumentVersion(stamp(),forged),false);
});
test('owner and target path must agree for any child document',()=>{
  assert.equal(deletionDocumentBelongsToSubject('exportJobs','job-1','owner-a','owner-a'),true);
  assert.equal(deletionDocumentBelongsToSubject('exportJobs','job-1','owner-a','owner-b'),false);
  assert.equal(deletionDocumentBelongsToSubject('exportJobs','job-1','owner-a',undefined),false);
});
test('primary user document ID and owner binding are both required',()=>{
  assert.equal(deletionDocumentBelongsToSubject('users','owner-a','owner-a',undefined),true);
  assert.equal(deletionDocumentBelongsToSubject('users','owner-a','owner-a','owner-a'),true);
  assert.equal(deletionDocumentBelongsToSubject('users','owner-b','owner-a',undefined),false);
  assert.equal(deletionDocumentBelongsToSubject('users','owner-a','owner-a','owner-b'),false);
});
test('path traversal and unsafe selectors are denied',()=>{
  assert.equal(deletionDocumentBelongsToSubject('exportJobs','../job','owner-a','owner-a'),false);
  assert.equal(deletionDocumentBelongsToSubject('exportJobs/foreign','job','owner-a','owner-a'),false);
  assert.equal(deletionDocumentBelongsToSubject('users','owner-a','../owner-a',undefined),false);
});
