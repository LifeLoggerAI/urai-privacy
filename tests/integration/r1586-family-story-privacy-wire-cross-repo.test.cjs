"use strict";
/**
 * R1586 Family Stories two-repository wire compatibility proof.
 * TEST ONLY: in-memory ephemeral keys and synthetic private-free fixture.
 * Does NOT approve purpose, mint canonical Privacy grants, or touch GCP.
 *
 * Execute from a complete Privacy review checkout, after `npm --prefix
 * functions run build`, with STORYTIME_REVIEW_VERIFIER_PATH pointing to
 * exact-source compiled Storytime family-privacy-receipt-signature.js.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign, createHash } = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");

const verifierPath = process.env.STORYTIME_REVIEW_VERIFIER_PATH;
if (!verifierPath || !path.isAbsolute(verifierPath) || !fs.existsSync(verifierPath)) {
  throw new Error("Exact Storytime compiled verifier file path required.");
}
const privacy = require("../../functions/lib/family-story-share-wire-review.js");
const story = require(verifierPath);
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const trust = {
  STORYTIME_FAMILY_PRIVACY_ED25519_KEY_ID: "synthetic-family-wire-r1586",
  STORYTIME_FAMILY_PRIVACY_ED25519_PUBLIC_KEY_SPKI_B64: publicKey.export({type:"spki",format:"der"}).toString("base64")
};
const fields = () => ({
  schemaVersion:"storytime-consent-decision-receipt-v1",
  id:"synthetic-consent-one",
  userId:"synthetic-grandma",
  sourceSessionId:"synthetic-story-one",
  recipientUid:"synthetic-mom",
  sourceVersionId:"synthetic-version-one",
  shareEpoch:1,
  purpose:"storytime.family_share",
  policyVersion:"family-story-share-v1",
  decision:"authorized",
  issuedBy:"urai-privacy",
  approvedProjectionSha256:createHash("sha256").update("synthetic-owner-approved-title-summary").digest("hex"),
  expiresAtMs:4102444800000
});
const sig = (data) => sign(null,privacy.canonicalReviewFamilyShareReceiptBytes(data),privateKey).toString("base64url");
const valid = (data,signature,keyId=trust.STORYTIME_FAMILY_PRIVACY_ED25519_KEY_ID,env=trust) =>
  story.verifyFamilyPrivacyReceiptSignature(data,signature,keyId,env);

test("canonical Privacy registry refuses unregistered family purpose; review has no issuer",()=>{
  assert.deepEqual(privacy.reviewFamilyShareIssuerAdmission(),{authorized:false,reason:"PURPOSE_UNREGISTERED"});
});
test("independent producer and Storytime consumer canonical bytes are identical",()=>{
  assert.deepEqual(privacy.canonicalReviewFamilyShareReceiptBytes(fields()),story.canonicalFamilyPrivacyReceiptBytes(fields()));
});
test("synthetic producer Ed25519 signature verifies with pinned Storytime public key",()=>{
  const data=fields();assert.equal(valid(data,sig(data)),true);
});
test("missing trust key or incorrect signer key identity denies",()=>{
  const d=fields(),s=sig(d);
  assert.equal(valid(d,s,undefined,{}),false);
  assert.equal(valid(d,s,"untrusted-test-issuer"),false);
});
for (const [name,change] of [
  ["recipient", {recipientUid:"synthetic-cousin"}],
  ["owner", {userId:"synthetic-other-owner"}],
  ["story", {sourceSessionId:"synthetic-private-second-story"}],
  ["source version", {sourceVersionId:"synthetic-version-two"}],
  ["epoch", {shareEpoch:2}],
  ["approved summary", {approvedProjectionSha256:"a".repeat(64)}],
  ["expiry", {expiresAtMs:4102444800001}],
  ["purpose", {purpose:"memory.storage"}],
  ["policy", {policyVersion:"family-story-share-v0"}],
  ["decision", {decision:"revoked"}],
  ["issuer marker", {issuedBy:"other-issuer"}],
  ["schema", {schemaVersion:"storytime-consent-decision-receipt-v0"}],
  ["receipt id", {id:"synthetic-consent-two"}]
]) {
  test("signed receipt is bound to immutable "+name,()=>{
    const d=fields(),signed=sig(d);assert.equal(valid({...d,...change},signed),false);
  });
}
test("forged signature, malformed signature, and untrusted public key deny",()=>{
  const d=fields(),s=sig(d);
  assert.equal(valid(d,"A".repeat(86)),false);
  assert.equal(valid(d,"not-a-signature"),false);
  const another=generateKeyPairSync("ed25519");
  assert.equal(valid(d,s,trust.STORYTIME_FAMILY_PRIVACY_ED25519_KEY_ID,{
    ...trust,STORYTIME_FAMILY_PRIVACY_ED25519_PUBLIC_KEY_SPKI_B64:
      another.publicKey.export({type:"spki",format:"der"}).toString("base64")
  }),false);
});
test("missing exact owner/recipient/story, negative epoch, malformed hash deny",()=>{
  const d=fields(),s=sig(d);
  for(const changed of [
    {userId:""},{recipientUid:""},{sourceSessionId:""},
    {shareEpoch:-1},{approvedProjectionSha256:"bad"},
  ]) assert.equal(valid({...d,...changed},s),false);
});
test("Privacy review encoder rejects unspecified extra fields and nonauthorized decisions",()=>{
  const d=fields();
  assert.throws(()=>privacy.canonicalReviewFamilyShareReceiptBytes({...d,extra:"unknown"}));
  assert.throws(()=>privacy.canonicalReviewFamilyShareReceiptBytes({...d,decision:"revoked"}));
  assert.throws(()=>privacy.canonicalReviewFamilyShareReceiptBytes({...d,purpose:"not-approved"}));
});
