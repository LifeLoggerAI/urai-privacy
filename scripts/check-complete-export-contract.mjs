import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const processor = fs.readFileSync(path.join(root, "functions/src/export-functions.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "functions/src/export-contract.ts"), "utf8");
const lifecycle = fs.readFileSync(
  path.join(root, "functions/src/export-lifecycle-functions.ts"),
  "utf8"
);
const lifecycleContract = fs.readFileSync(
  path.join(root, "functions/src/export-lifecycle-contract.ts"),
  "utf8"
);
const deployedExports = fs.readFileSync(path.join(root, "functions/src/exports.ts"), "utf8");

const failures = [];

function requireMatch(label, value, pattern) {
  if (!pattern.test(value)) failures.push(label);
}

function rejectMatch(label, value, pattern) {
  if (pattern.test(value)) failures.push(label);
}

requireMatch(
  "active surface must export processExportRequest from export-functions",
  deployedExports,
  /export\s*\{\s*processExportRequest\s*\}\s*from\s*["']\.\/export-functions["']/m
);
requireMatch(
  "active surface must export download and cleanup functions from export-lifecycle-functions",
  deployedExports,
  /getExportDownloadUrl[\s\S]*cleanupExpiredExportPackages[\s\S]*from\s*["']\.\/export-lifecycle-functions["']/m
);
rejectMatch(
  "legacy index surface must not re-export processExportRequest",
  deployedExports,
  /export\s*\{[^}]*processExportRequest[^}]*\}\s*from\s*["']\.\/index["']/ms
);
rejectMatch(
  "legacy index surface must not re-export getExportDownloadUrl",
  deployedExports,
  /export\s*\{[^}]*getExportDownloadUrl[^}]*\}\s*from\s*["']\.\/index["']/ms
);
rejectMatch(
  "processor must not contain the former hard 1000-record query ceiling",
  processor,
  /\.limit\(\s*1000\s*\)/
);
requireMatch(
  "processor must use deterministic document-id ordering",
  processor,
  /orderBy\(FieldPath\.documentId\(\)\)/
);
requireMatch(
  "processor must advance with a cursor",
  processor,
  /startAfter\(cursor\)/
);
requireMatch(
  "processor must atomically claim jobs",
  processor,
  /runTransaction[\s\S]*status:\s*["']processing["']/
);
requireMatch(
  "processor must write a complete manifest",
  processor,
  /complete:\s*true/
);
requireMatch(
  "processor must record collection counts",
  processor,
  /collectionCounts/
);
requireMatch(
  "processor must write package and manifest digests",
  processor,
  /manifestSha256[\s\S]*exportSha256/
);
requireMatch(
  "contract must include consent events",
  contract,
  /collection:\s*["']consentEvents["']/
);
requireMatch(
  "contract must include consent decisions",
  contract,
  /collection:\s*["']consentDecisions["']/
);
requireMatch(
  "contract must recursively scrub array entries",
  contract,
  /value\.map\(\(entry\)\s*=>\s*serializeForExport\(entry\)\)/
);
requireMatch(
  "lifecycle must enforce owner or administrative access",
  lifecycle,
  /requireOwnerOrAdmin\(request\.auth,\s*uid\)/
);
requireMatch(
  "download links must not outlive the package",
  lifecycle,
  /Math\.min\([\s\S]*EXPORT_DOWNLOAD_URL_TTL_MS[\s\S]*packageExpiresAt/
);
requireMatch(
  "download must verify job-scoped object paths",
  lifecycle,
  /validExportObjectPath\(\{\s*uid,\s*jobId,\s*path\s*\}\)/
);
requireMatch(
  "expired package cleanup must be scheduled",
  lifecycle,
  /cleanupExpiredExportPackages\s*=\s*onSchedule/
);
requireMatch(
  "cleanup must tolerate already-missing objects",
  lifecycle,
  /delete\(\{\s*ignoreNotFound:\s*true\s*\}\)/
);
requireMatch(
  "cleanup must mark packages expired",
  lifecycle,
  /status:\s*["']expired["']/
);
requireMatch(
  "package lifetime must be bounded",
  lifecycleContract,
  /EXPORT_PACKAGE_TTL_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/
);
requireMatch(
  "path contract must reject traversal",
  lifecycleContract,
  /!args\.path\.includes\(["']\.\.["']\)/
);

if (failures.length > 0) {
  console.error("Complete export contract gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Complete export contract gate passed.");
