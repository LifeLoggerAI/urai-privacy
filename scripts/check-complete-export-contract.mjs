import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const processorPath = path.join(root, "functions/src/export-functions.ts");
const contractPath = path.join(root, "functions/src/export-contract.ts");
const exportsPath = path.join(root, "functions/src/exports.ts");

const processor = fs.readFileSync(processorPath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");
const deployedExports = fs.readFileSync(exportsPath, "utf8");

const failures = [];

function requireMatch(label, value, pattern) {
  if (!pattern.test(value)) failures.push(label);
}

function rejectMatch(label, value, pattern) {
  if (pattern.test(value)) failures.push(label);
}

requireMatch(
  "deployed function surface must export processExportRequest from export-functions",
  deployedExports,
  /export\s*\{\s*processExportRequest\s*\}\s*from\s*["']\.\/export-functions["']/m
);
rejectMatch(
  "legacy index export surface must not re-export processExportRequest",
  deployedExports,
  /export\s*\{[^}]*processExportRequest[^}]*\}\s*from\s*["']\.\/index["']/ms
);
rejectMatch(
  "complete export processor must not contain the former hard 1000-record query ceiling",
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
  "processor must write cryptographic digests",
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

if (failures.length > 0) {
  console.error("Complete export contract gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Complete export contract gate passed.");
