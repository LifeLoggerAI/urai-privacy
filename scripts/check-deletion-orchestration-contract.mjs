import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const surface = fs.readFileSync(path.join(root, "functions/src/exports.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "functions/src/deletion-contract.ts"), "utf8");
const inventory = fs.readFileSync(path.join(root, "functions/src/deletion-inventory.ts"), "utf8");
const handlers = fs.readFileSync(path.join(root, "functions/src/deletion-functions.ts"), "utf8");

const failures = [];
function required(label, value, pattern) {
  if (!pattern.test(value)) failures.push(label);
}
function forbidden(label, value, pattern) {
  if (pattern.test(value)) failures.push(label);
}

required(
  "active surface must use the new orchestration handlers",
  surface,
  /processDeletionRequest[\s\S]*executeDeletionRequest[\s\S]*deletion-functions/
);
forbidden(
  "legacy deletion handlers must not remain on the active index export",
  surface,
  /processDeletionRequest[\s\S]*from\s*["']\.\/index["']/
);
required("manifest version", contract, /DELETION_MANIFEST_VERSION/);
required("authentication adapter", contract, /firebase-auth/);
required("pending adapter state", contract, /status:\s*["']pending["']/);
required("pending adapter blocker", contract, /PENDING_ADAPTERS/);
required("legal hold blocker", contract, /ACTIVE_LEGAL_HOLD/);
required("authentication inventory", inventory, /auth\.getUser\(uid\)/);
required("object inventory", inventory, /bucket\.getFiles/);
required("legal hold inventory", inventory, /legalHoldRecords/);
required("stable plan hash response", handlers, /planHash:\s*prepared\.planHash/);
required(
  "execution remains fail closed",
  handlers,
  /verification gate is certified/
);

if (failures.length > 0) {
  console.error("Deletion contract gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Deletion contract gate passed.");
