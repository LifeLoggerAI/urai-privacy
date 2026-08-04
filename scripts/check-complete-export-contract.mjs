import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (pathname) => fs.readFileSync(path.join(root, pathname), "utf8");

const packageJson = JSON.parse(read("functions/package.json"));
const deployedEntry = read("functions/src/functions-entry.ts");
const compatibilityExports = read("functions/src/exports.ts");
const compatibilityProcessor = read("functions/src/export-functions.ts");
const compatibilityConsent = read("functions/src/consent-functions.ts");
const processor = read("functions/src/export-request.ts");
const consentApi = read("functions/src/consent-api.ts");
const contract = read("functions/src/export-contract.ts");
const lifecycle = read("functions/src/export-lifecycle-functions.ts");
const lifecycleContract = read("functions/src/export-lifecycle-contract.ts");

const failures = [];
const requireMatch = (label, value, pattern) => {
  if (!pattern.test(value)) failures.push(label);
};
const rejectMatch = (label, value, pattern) => {
  if (pattern.test(value)) failures.push(label);
};

if (packageJson.main !== "lib/functions-entry.js") {
  failures.push("functions/package.json must deploy lib/functions-entry.js");
}

requireMatch(
  "deployed entry must export processExportRequest from export-request",
  deployedEntry,
  /export\s*\{\s*processExportRequest\s*\}\s*from\s*["']\.\/export-request["']/m
);
requireMatch(
  "deployed entry must export lifecycle download and scheduled cleanup",
  deployedEntry,
  /getExportDownloadUrl[\s\S]*cleanupExpiredExportPackages[\s\S]*from\s*["']\.\/export-lifecycle-functions["']/m
);
requireMatch(
  "deployed entry must export canonical consent API",
  deployedEntry,
  /setCanonicalConsent[\s\S]*evaluateCanonicalConsent[\s\S]*from\s*["']\.\/consent-api["']/m
);
rejectMatch(
  "deployed entry must not reference alternate consent or export authorities",
  deployedEntry,
  /\.\/(?:consent-functions|consent-policy|export-functions|exports)["']/
);
requireMatch(
  "compatibility exports must mirror functions-entry exactly",
  compatibilityExports,
  /export\s*\*\s*from\s*["']\.\/functions-entry["']/m
);
requireMatch(
  "compatibility export processor must delegate to export-request",
  compatibilityProcessor,
  /export\s*\{\s*processExportRequest\s*\}\s*from\s*["']\.\/export-request["']/m
);
requireMatch(
  "compatibility consent surface must delegate to consent-api",
  compatibilityConsent,
  /setCanonicalConsent[\s\S]*evaluateCanonicalConsent[\s\S]*from\s*["']\.\/consent-api["']/m
);
rejectMatch(
  "compatibility consent surface must not implement callable, storage, or audit behavior",
  compatibilityConsent,
  /onCall|getFirestore|runTransaction|collection\(/
);

requireMatch("processor must include revocation outbox", processor, /consentRevocationOutbox/);
requireMatch("processor must include revocation acknowledgements", processor, /acknowledgements/);
requireMatch("processor must bind acknowledgements to parent events", processor, /eventId:\s*outbox\.id/);
requireMatch("processor must use a bounded lease", processor, /EXPORT_PROCESSING_LEASE_MS/);
requireMatch("processor must persist lease expiry", processor, /processingLeaseExpiresAt/);
requireMatch("processor must reject an active lease", processor, /processingLeaseIsActive/);
requireMatch("processor must permit stale-lease takeover", processor, /status\s*===\s*["']processing["'][\s\S]*processingLeaseIsActive/);
requireMatch("processor must use deterministic document ordering", processor, /orderBy\(FieldPath\.documentId\(\)\)/);
requireMatch("processor must paginate with a cursor", processor, /startAfter\(cursor\)/);
requireMatch("processor must atomically claim jobs", processor, /runTransaction[\s\S]*status:\s*["']processing["']/);
requireMatch("processor must verify claim ownership before completion", processor, /processingBy[\s\S]*(?:operatorUid|adminUid)/);
requireMatch("processor must write package and manifest digests", processor, /manifestSha256[\s\S]*exportSha256/);
rejectMatch("processor must not contain the former hard 1000-record ceiling", processor, /\.limit\(\s*1000\s*\)/);

requireMatch("canonical consent must require a consumer-bound system authority", consentApi, /consumerId/);
requireMatch("canonical consent must reject unbound cross-user access", consentApi, /if\s*\(!authority\)/);
requireMatch("canonical consent must commit record, event, and audit in one transaction", consentApi, /runTransaction[\s\S]*transaction\.set\(recordRef[\s\S]*transaction\.set\(eventRef[\s\S]*transaction\.set\(auditRef/);

requireMatch("contract must include consent events", contract, /collection:\s*["']consentEvents["']/);
requireMatch("contract must include consent decisions", contract, /collection:\s*["']consentDecisions["']/);
requireMatch("contract must recursively scrub array entries", contract, /value\.map\(\(entry\)\s*=>\s*serializeForExport\(entry\)\)/);
requireMatch("lifecycle must enforce owner or administrative access", lifecycle, /requireOwnerOrAdmin\(request\.auth,\s*uid\)/);
requireMatch("download links must not outlive the package", lifecycle, /Math\.min\([\s\S]*EXPORT_DOWNLOAD_URL_TTL_MS[\s\S]*packageExpiresAt/);
requireMatch("download must verify job-scoped object paths", lifecycle, /validExportObjectPath\(\{\s*uid,\s*jobId,\s*path\s*\}\)/);
requireMatch("expired package cleanup must be scheduled", lifecycle, /cleanupExpiredExportPackages\s*=\s*onSchedule/);
requireMatch("cleanup must tolerate missing objects", lifecycle, /delete\(\{\s*ignoreNotFound:\s*true\s*\}\)/);
requireMatch("cleanup must mark packages expired", lifecycle, /status:\s*["']expired["']/);
requireMatch("package lifetime must be bounded", lifecycleContract, /EXPORT_PACKAGE_TTL_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
requireMatch("path contract must reject traversal", lifecycleContract, /!args\.path\.includes\(["']\.\.["']\)/);

if (failures.length) {
  console.error("Canonical privacy surface contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Canonical privacy surface contract passed.");
