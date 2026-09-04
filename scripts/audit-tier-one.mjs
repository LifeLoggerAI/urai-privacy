import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "README.md",
  "docs/IMPLEMENTATION_PLAN.md",
  "docs/PRIVACY_WORKFLOWS.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/INTEGRATION_BACKLOG.md",
  "docs/USER_RIGHTS_INTAKE_SPEC.md",
  "src/lib/privacy-types.ts",
  "src/lib/privacy-workflows.ts",
  "functions/src/index.ts",
  "functions/src/functions-entry.ts",
  "functions/src/consent-api.ts",
  "functions/src/consent-decision.ts",
  "firestore.rules",
  "storage.rules",
  "firebase.json",
  "package.json",
  "functions/package.json"
];

const requiredPrivacyTerms = [
  "consent",
  "export",
  "deletion",
  "retention",
  "audit",
  "admin",
  "privacyRequests",
  "consentRecords",
  "deletionRequests",
  "exportJobs"
];

const failures = [];

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path)) {
    failures.push(`Missing required Tier-One file: ${file}`);
  }
}

const joinedEvidence = requiredFiles
  .filter((file) => existsSync(join(root, file)))
  .map((file) => readFileSync(join(root, file), "utf8"))
  .join("\n\n");

for (const term of requiredPrivacyTerms) {
  if (!joinedEvidence.includes(term)) {
    failures.push(`Missing required Tier-One privacy term: ${term}`);
  }
}

const functionsSourcePaths = [
  "functions/src/index.ts",
  "functions/src/functions-entry.ts",
  "functions/src/consent-api.ts"
].map((file) => join(root, file));
if (functionsSourcePaths.every((path) => existsSync(path))) {
  const source = functionsSourcePaths.map((path) => readFileSync(path, "utf8")).join("\n\n");

  const requiredFunctions = [
    "createExportRequest",
    "processExportRequest",
    "createDeletionRequest",
    "processDeletionRequest",
    "setCanonicalConsent",
    "evaluateCanonicalConsent",
    "writeAuditLog",
    "recordAdminAction",
    "getPrivacyHealthReport"
  ];

  for (const fn of requiredFunctions) {
    const locallyExported = source.includes(`export const ${fn}`);
    const reExported = source.includes(fn) && source.includes("export {");
    if (!locallyExported && !reExported) {
      failures.push(`Missing callable Function export: ${fn}`);
    }
  }

  if (source.includes("export const updateConsent")) {
    failures.push("Retired updateConsent callable must not reappear; canonical consent exports are required.");
  }

  if (!source.includes("HttpsError")) {
    failures.push("Callable Functions should use HttpsError for safe client-facing failures.");
  }

  if (!source.includes("FieldValue.serverTimestamp")) {
    failures.push("Callable Functions should use server timestamps for auditable records.");
  }
}

const firestoreRulesPath = join(root, "firestore.rules");
if (existsSync(firestoreRulesPath)) {
  const rules = readFileSync(firestoreRulesPath, "utf8");

  if (!rules.includes("auditLogs")) {
    failures.push("Firestore rules must explicitly cover auditLogs.");
  }

  if (!rules.includes("allow read, write: if false") && !rules.includes("allow write: if false")) {
    failures.push("Firestore rules must include deny-by-default fallback behavior.");
  }
}

const storageRulesPath = join(root, "storage.rules");
if (existsSync(storageRulesPath)) {
  const rules = readFileSync(storageRulesPath, "utf8");

  if (!rules.includes("exports")) {
    failures.push("Storage rules must explicitly cover export artifacts.");
  }

  if (!rules.includes("allow read, write: if false") && !rules.includes("allow write: if false")) {
    failures.push("Storage rules must include deny-by-default fallback behavior.");
  }
}

if (failures.length > 0) {
  console.error("[audit-tier-one] FAILED");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[audit-tier-one] OK: Tier-One privacy control-plane evidence is present");
