import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const activeSurface = fs.readFileSync(path.join(root, "functions/src/functions-entry.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "functions/src/deletion-contract.ts"), "utf8");
const inventory = fs.readFileSync(path.join(root, "functions/src/deletion-inventory.ts"), "utf8");
const previewHandlers = fs.readFileSync(path.join(root, "functions/src/deletion-functions.ts"), "utf8");
const localExecutor = fs.readFileSync(path.join(root, "functions/src/deletion-local-executor.ts"), "utf8");
const documentation = fs.readFileSync(path.join(root, "docs/DELETION_ORCHESTRATION.md"), "utf8");

const failures = [];
function required(label, value, pattern) {
  if (!pattern.test(value)) failures.push(label);
}
function forbidden(label, value, pattern) {
  if (pattern.test(value)) failures.push(label);
}

required(
  "canonical active surface must retain hardened deletion mutation guard",
  activeSurface,
  /processDeletionRequest[\s\S]*executeDeletionRequest[\s\S]*deletion-mutation-guard/
);
forbidden(
  "retained preview handlers must not be exported by the active surface",
  activeSurface,
  /deletion-functions/
);
required("manifest version", contract, /DELETION_MANIFEST_VERSION/);
required("authentication adapter", contract, /firebase-auth/);
required("pending adapter state", contract, /status:\s*["']pending["']/);
required("pending adapter blocker", contract, /PENDING_ADAPTERS/);
required("legal hold blocker", contract, /ACTIVE_LEGAL_HOLD/);
required("authentication inventory", inventory, /auth\.getUser\(uid\)/);
required("object inventory", inventory, /bucket\.getFiles/);
required("legal hold inventory", inventory, /legalHoldRecords/);
required("stable plan hash response", previewHandlers, /planHash:\s*prepared\.planHash/);
required(
  "preview execution remains fail closed",
  previewHandlers,
  /verification gate is certified/
);
required("local executor has post-action verification", localExecutor, /verifyLocalDeletion/);
forbidden(
  "local destructive executor must not be imported by retained preview handlers",
  previewHandlers,
  /deletion-local-executor/
);
required(
  "documentation must identify the canonical active mutation guard",
  documentation,
  /canonical callable deletion surface remains `functions\/src\/deletion-mutation-guard\.ts`/
);
forbidden(
  "documentation must not claim preview handlers are deployed",
  documentation,
  /deployed function surface uses `functions\/src\/deletion-functions\.ts`/
);

if (failures.length > 0) {
  console.error("Deletion orchestration retention gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Deletion orchestration retention gate passed.");
