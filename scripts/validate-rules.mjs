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
  "match /exports/{uid}/{allPaths=**}",
  "allow read, write: if false",
  "match /evidence/{allPaths=**}",
  "request.auth.token.admin == true",
  "request.auth.token.role == 'admin'"
];

if (!/match \/exports\/\{uid\}\/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;/.test(storage)) {
  failures.push("private exports must deny direct client reads and writes")
}
const exportLifecycle = readFileSync("functions/src/export-lifecycle-functions.ts", "utf8");
for (const check of ["packageExpiresAt <= now", "verifyIdToken(bearer, true)", "pipeline(stream, guardedChunks, response)"]) {
  if (!exportLifecycle.includes(check)) failures.push(`guarded export delivery missing ${check}`)
}
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

if (failures.length > 0) {
  console.error("[validate-rules] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[validate-rules] ok");
