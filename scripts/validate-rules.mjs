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

if (failures.length > 0) {
  console.error("[validate-rules] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[validate-rules] ok");
