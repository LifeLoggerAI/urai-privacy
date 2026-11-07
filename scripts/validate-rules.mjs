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
// Static preflight is supplemental to the required real Firestore emulator.
// Reject permissive tombstone comparisons that mistake malformed data for
// a verified, inactive deletion fence (including active: "false" or zero).
const ownerFence = firestore.match(/function deletionFenceIsInactive\(uid\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
if (!/\.data\.get\(['"]active['"],\s*null\)\s*==\s*false/.test(ownerFence)) {
  failures.push("owner deletion fence must require an explicit inactive boolean, not active != true");
}
for (const leaseField of [
  "deletionPlanningLeaseToken",
  "deletionPlanningLeaseUntil",
  "deletionPlanningLeaseRequestId",
  "deletionPlanningLeaseOperation",
  "deletionPlanningLeaseBy"
]) {
  if (!ownerFence.includes(leaseField)) failures.push(`owner deletion fence missing planning lease guard: ${leaseField}`);
}
if (!ownerFence.includes("!exists(tombstone)") ||
    !ownerFence.includes("data.keys().hasAny([")) {
  failures.push("owner deletion fence must reject unreconciled planning leases");
}

// Storage must fence private export reads and admin writes throughout a
// deletion-planning lease, not only after the final active tombstone is set.
const storageFence = storage.match(/function deletionFenceIsInactive\(uid\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
if (!/\.data\.get\(['"]active['"],\s*null\)\s*==\s*false/.test(storageFence)) {
  failures.push("storage deletion fence must require an explicit inactive boolean");
}
for (const leaseField of [
  "deletionPlanningLeaseToken",
  "deletionPlanningLeaseUntil",
  "deletionPlanningLeaseRequestId",
  "deletionPlanningLeaseOperation",
  "deletionPlanningLeaseBy"
]) {
  if (!storageFence.includes(leaseField)) failures.push(`storage deletion fence missing planning lease guard: ${leaseField}`);
}
if (!storageFence.includes("!firestore.exists(tombstone)") ||
    !storageFence.includes("data.keys().hasAny([")) {
  failures.push("storage deletion fence must reject unreconciled planning leases");
}

const storageChecks = [
  "match /exports/{uid}/{allPaths=**}",
  "allow read, write: if false",
  "match /evidence/{allPaths=**}",
  "request.auth.token.admin == true",
  "request.auth.token.role == 'admin'"
];

// A permit on any overlapping /exports path would override broker-only
// delivery; deny ALL Storage SDK export reads and writes, including admins.
const exportMatches = [...storage.matchAll(/match\s+\/exports\//g)];
if (exportMatches.length !== 1 || !/match\s+\/exports\/\{uid\}\/\{allPaths=\*\*\}\s*\{\s*allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;\s*\}/.test(storage)) {
  failures.push("export Storage paths must have exactly one catch-all direct read/write DENY rule");
}

for (const check of firestoreChecks) if (!firestore.includes(check)) failures.push(`firestore missing ${check}`);
for (const check of storageChecks) if (!storage.includes(check)) failures.push(`storage missing ${check}`);
// Server-owned Life Movie rights and approval evidence must never become
// client-writable or directly queryable through a future rules change.
// Catch-all deny is required until a separately approved access policy exists.
for (const collection of [
  "lifeMovieSourceRights",
  "lifeMovieSourceRightsDecisions",
  "lifeMovieScopedGrantApprovals"
]) {
  const match = new RegExp("match\\s+/" + collection + "\\s*/\\{");
  if (match.test(firestore)) {
    failures.push("unreviewed direct Firestore rules for server-owned " + collection);
  }
}
const catchAll = /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;\s*\}/;
if (!catchAll.test(firestore)) failures.push("firestore catch-all must explicitly deny reads and writes");
if (!storage.includes("match /{allPaths=**}")) failures.push("storage missing fallback match");
if (firestore.includes("function isRoleAdmin()")) failures.push("firestore must not trust role documents for admin authority");
if (firestore.includes("get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'")) {
  failures.push("firestore must not derive admin authority from owner-writable user documents");
}
if (firestore.includes("match /consentDecisions/{id}")) {
  failures.push("firestore must not revive the superseded consentDecisions collection");
}

// Shared server-owned profile authority across Privacy and Spatial.
// Source check supplements, never substitutes for, a real Firestore emulator.
const sharedProtectedFields = ["role","admin","isAdmin","legalHold","markedForDeletion","deletionMarkedAt","entitlementTier","founderOverride","deleted","accountStatus"];
const ownerCreate = firestore.match(/function ownerIsNotCreatingPrivilegedFields\(\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
const ownerUpdate = firestore.match(/function ownerIsNotChangingPrivilegedFields\(\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
if (!ownerCreate.includes('request.resource.data.keys().hasAny(')) failures.push('owner create must guard all created profile keys');
if (!ownerUpdate.includes('request.resource.data.diff(resource.data).affectedKeys().hasAny(')) failures.push('owner update must guard added, changed and removed profile keys');
for (const field of sharedProtectedFields) {
  if (!ownerCreate.includes("'" + field + "'")) failures.push('owner create permits server-owned profile field: ' + field);
  if (!ownerUpdate.includes("'" + field + "'")) failures.push('owner update permits server-owned profile field: ' + field);
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
