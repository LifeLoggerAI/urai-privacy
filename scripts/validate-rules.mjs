#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const failures = [];
const needFiles = ["firestore.rules", "storage.rules", "firestore.indexes.json", "firebase.json"];
for (const file of needFiles) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}

const firestore = existsSync("firestore.rules") ? readFileSync("firestore.rules", "utf8") : "";
const storage = existsSync("storage.rules") ? readFileSync("storage.rules", "utf8") : "";

const firestoreChecks = [
  "match /auditLogs/{id}",
  "function isAdmin()",
  "function isOwner(uid)",
  "request.auth.token.admin == true",
  "request.auth.token.role == 'admin'",
  "ownerIsNotCreatingPrivilegedFields",
  "ownerIsNotChangingPrivilegedFields",
  "match /privacyRequests/{id}",
  "match /deletionRequests/{id}",
  "match /consentRecords/{id}",
  "match /consentEvents/{id}",
  "match /consentRevocationOutbox/{id}",
  "match /acknowledgements/{consumerId}",
  "allow create, update, delete: if false"
];
const storageChecks = [
  "match /exports/{uid}/{jobId}/{fileName}",
  "activeExportPackage(uid, jobId)",
  "packageExpiresAt > request.time",
  "match /evidence/{allPaths=**}",
  "request.auth.token.admin == true",
  "request.auth.token.role == 'admin'"
];

for (const check of firestoreChecks) if (!firestore.includes(check)) failures.push(`firestore missing ${check}`);
for (const check of storageChecks) if (!storage.includes(check)) failures.push(`storage missing ${check}`);
if (!firestore.includes("match /{document=**}")) failures.push("firestore missing fallback match");
if (!storage.includes("match /{allPaths=**}")) failures.push("storage missing fallback match");
if (firestore.includes("function isRoleAdmin()")) failures.push("firestore must not trust role documents for admin authority");
if (firestore.includes("get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'")) {
  failures.push("firestore must not derive admin authority from owner-writable user documents");
}
if (firestore.includes("match /consentDecisions/{id}")) {
  failures.push("firestore must not revive the superseded consentDecisions collection");
}

// Shared owner-profile authority boundary across Privacy and Spatial.
// This static check is a source guard, not a substitute for emulator evaluation.
const sharedProtectedFields = ["role","admin","isAdmin","legalHold","markedForDeletion","deletionMarkedAt","entitlementTier","founderOverride","deleted","accountStatus"];
const ownerCreate = firestore.match(/function ownerIsNotCreatingPrivilegedFields\(\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
const ownerUpdate = firestore.match(/function ownerIsNotChangingPrivilegedFields\(\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
if (!ownerCreate.includes('request.resource.data.keys().hasAny(')) failures.push('owner create must test all created field keys');
if (!ownerUpdate.includes('request.resource.data.diff(resource.data).affectedKeys().hasAny(')) failures.push('owner update must test added, removed and changed keys');
for (const field of sharedProtectedFields) {
  if (!ownerCreate.includes("'" + field + "'")) failures.push('owner create permits server-owned profile field: ' + field);
  if (!ownerUpdate.includes("'" + field + "'")) failures.push('owner update permits server-owned profile field: ' + field);
}


// Strict tombstone / identity reconciliation shared with Spatial's profile boundary.
const deletionFence = firestore.match(/function deletionFenceIsInactive\(uid\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
for (const check of [
  "let tombstone = /databases/$(database)/documents/privacyDeletionTombstones/$(uid);",
  "!exists(tombstone)",
  "get(tombstone).data.get('active', null) == false",
  "!get(tombstone).data.keys().hasAny(["
]) if (!deletionFence.includes(check)) failures.push('deletion fence missing: ' + check);
if (deletionFence.includes('.data.active != true')) failures.push('deletion fence must deny malformed active state');
for (const field of ['deletionPlanningLeaseToken','deletionPlanningLeaseUntil',
  'deletionPlanningLeaseRequestId','deletionPlanningLeaseOperation','deletionPlanningLeaseBy']) {
  if (!deletionFence.includes("'" + field + "'")) failures.push('deletion fence missing lease marker: ' + field);
}
const createIdentity = firestore.match(/function ownerProfileIdentityOnCreate\(uid\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
const updateIdentity = firestore.match(/function ownerProfileIdentityOnUpdate\(uid\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
for (const field of ['userId', 'ownerId']) {
  if (!createIdentity.includes('request.resource.data.' + field + ' == uid')) failures.push('profile create identity missing: ' + field);
  if (!updateIdentity.includes('resource.data.' + field + ' == uid')) failures.push('profile update old identity missing: ' + field);
}
if (!updateIdentity.includes('ownerProfileIdentityOnCreate(uid)')) failures.push('profile update new identity not validated');
const profileWrite = firestore.match(/match \/users\/\{uid\} \{([\s\S]*?)\n    \}/)?.[1] ?? '';
for (const [action, fragment] of [
  ['create','ownerProfileIdentityOnCreate(uid)'],
  ['update','ownerProfileIdentityOnUpdate(uid)']
]) {
  const expression = profileWrite.match(new RegExp('allow ' + action + ': if ([\\s\\S]*?);'))?.[1] ?? '';
  if (!expression.includes(fragment)) failures.push('owner profile ' + action + ' does not enforce identity');
  if (!expression.includes('deletionFenceIsInactive(uid)')) failures.push('owner profile ' + action + ' does not enforce deletion fence');
}

if (failures.length > 0) {
  console.error("[validate-rules] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[validate-rules] ok");
