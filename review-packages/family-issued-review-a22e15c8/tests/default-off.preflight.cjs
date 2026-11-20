"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
async function main() {
  assert.equal(process.env.FAMILY_ISSUED_REVIEW_ENABLED, undefined);
  assert.equal(process.env.FAMILY_ISSUED_REVIEW_POLICY, undefined);
  assert.equal(process.env.STORYTIME_FAMILY_SHARING_ENABLED, undefined);
  const issuer = require(path.join(root, "privacy/functions/lib/family-story-share-issued-review.js"));
  const receiver = require(path.join(root, "storytime/functions/lib/family-privacy-delivery-review.js"));
  const story = require(path.join(root, "storytime/functions/lib/family-story-sharing.js"));
  const admission = require(path.join(root, "privacy/functions/lib/family-story-share-wire-review.js"));
  assert.deepEqual(admission.reviewFamilyShareIssuerAdmission(), {authorized: false, reason: "PURPOSE_UNREGISTERED"});
  for (const callable of [issuer.reviewIssueFamilyGrant, issuer.reviewWithdrawFamilyGrant,
    issuer.reviewDeleteFamilySubject, issuer.reviewDispatchFamilyEvent,
    receiver.reviewAcceptFamilyEvent, story.grantFamilyStoryView]) {
    await assert.rejects(callable.run({data: {}}), error => error.code === "failed-precondition");
  }
  console.log("DEFAULT_OFF_AND_CANONICAL_DENIAL_PASS: 6 callables guarded; canonical PURPOSE_UNREGISTERED");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
