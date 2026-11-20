"use strict";
// Disposable emulator-only exports. This is never an ordinary deployment entry.
// Firebase CLI discovery forwards standard emulator configuration but strips
// custom parent environment variables while reading callable metadata. Import
// performs no authority writes. Every new callable independently requires all
// activation, synthetic-policy and fixed-host guards at invocation time.
const expected = {
  GCLOUD_PROJECT: "demo-urai-family-issued-review",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:30099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:30080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:30199",
  FUNCTIONS_EMULATOR: "true",
};
for (const [key, value] of Object.entries(expected)) {
  if (process.env[key] !== value) throw new Error("EXACT_ISOLATED_FAMILY_ISSUED_FIXTURE_REQUIRED:" + key);
}
const path = require("node:path");
const { createRequire } = require("node:module");
for (const service of ["privacy", "storytime"]) {
  const r = createRequire(path.resolve(__dirname, "../../", service, "functions/package.json"));
  const app = r("firebase-admin/app");
  if (!app.getApps().length) app.initializeApp();
}
const canonical = require("../../privacy/functions/lib/consent-api.js");
const issuer = require("../../privacy/functions/lib/family-story-share-issued-review.js");
const receiver = require("../../storytime/functions/lib/family-privacy-delivery-review.js");
const story = require("../../storytime/functions/lib/family-story-sharing.js");
exports.privacySetCanonicalConsent = canonical.setCanonicalConsent;
exports.privacyEvaluateCanonicalConsent = canonical.evaluateCanonicalConsent;
for (const name of ["reviewIssueFamilyGrant", "reviewWithdrawFamilyGrant", "reviewDeleteFamilySubject", "reviewDispatchFamilyEvent"]) {
  exports[name] = issuer[name];
}
exports.reviewAcceptFamilyEvent = receiver.reviewAcceptFamilyEvent;
exports.grantFamilyStoryView = story.grantFamilyStoryView;
exports.getFamilyStoryView = story.getFamilyStoryView;
exports.revokeFamilyStoryView = story.revokeFamilyStoryView;
