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
  "match /exports/{uid}/{jobId}/{fileName}",
  "activeExportPackage(uid, jobId)",
  "packageExpiresAt > request.time",
  "match /evidence/{allPaths=**}",
  "request.auth.token.admin == true",
  "request.auth.token.role == 'admin'"
];

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

if (failures.length > 0) {
  console.error("[validate-rules] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[validate-rules] ok");
