#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const requiredEnv = [
  "URAI_PRIVACY_FIREBASE_PROJECT_ID",
  "URAI_PRIVACY_BASE_URL",
  "URAI_PRIVACY_FUNCTIONS_REGION",
  "URAI_PRIVACY_RELEASE_SHA",
  "URAI_PRIVACY_OPERATOR"
];

const booleanEvidenceEnv = [
  "URAI_PRIVACY_AUTH_PROVIDER_VERIFIED",
  "URAI_PRIVACY_ADMIN_CLAIM_VERIFIED",
  "URAI_PRIVACY_FIRESTORE_RULES_DEPLOYED",
  "URAI_PRIVACY_STORAGE_RULES_DEPLOYED",
  "URAI_PRIVACY_MONITORING_CONFIGURED",
  "URAI_PRIVACY_LEGAL_APPROVAL"
];

const shaEvidenceEnv = [
  "URAI_PRIVACY_ROLLBACK_SHA"
];

const secretNamePattern = /(TOKEN|SECRET|PRIVATE|KEY|PASSWORD|CREDENTIAL|SERVICE_ACCOUNT|COOKIE|SESSION)/i;
const shaPattern = /^[0-9a-f]{7,40}$/i;
const requireLive = process.env.URAI_PRIVACY_REQUIRE_LIVE === "1";
const evidenceDir = process.env.URAI_PRIVACY_EVIDENCE_DIR || "release-evidence/staging";

function fail(message) {
  console.error(`[staging-evidence] ${message}`);
  process.exit(1);
}

function warning(message) {
  console.warn(`[staging-evidence] WARN: ${message}`);
}

function redact(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 8) return "<set>";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function hashValue(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function yesNo(value) {
  if (!value) return "no";
  return /^(1|true|yes|y)$/i.test(String(value)) ? "yes" : "no";
}

function validateUrl(name, value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") fail(`${name} must use https:// for staging/prod evidence`);
    return parsed;
  } catch {
    fail(`${name} must be a valid URL`);
  }
}

for (const name of requiredEnv) {
  if (!process.env[name]) {
    const message = `${name} is required to generate staging evidence`;
    if (requireLive) fail(message);
    warning(`${message}; set URAI_PRIVACY_REQUIRE_LIVE=1 to make this blocking`);
  }
}

for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith("URAI_PRIVACY_") && secretNamePattern.test(name) && value) {
    fail(`${name} looks like a secret-bearing variable. Do not feed secrets to the evidence generator.`);
  }
}

const baseUrl = process.env.URAI_PRIVACY_BASE_URL ? validateUrl("URAI_PRIVACY_BASE_URL", process.env.URAI_PRIVACY_BASE_URL) : null;

if (process.env.URAI_PRIVACY_FIREBASE_PROJECT_ID && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(process.env.URAI_PRIVACY_FIREBASE_PROJECT_ID)) {
  fail("URAI_PRIVACY_FIREBASE_PROJECT_ID does not look like a Firebase project id");
}

if (process.env.URAI_PRIVACY_RELEASE_SHA && !shaPattern.test(process.env.URAI_PRIVACY_RELEASE_SHA)) {
  fail("URAI_PRIVACY_RELEASE_SHA must be a short or full git SHA");
}

for (const name of shaEvidenceEnv) {
  if (process.env[name] && !shaPattern.test(process.env[name])) {
    fail(`${name} must be a short or full git SHA`);
  }
}

let firebaseCli = "not checked";
try {
  const { stdout } = await execFileAsync("firebase", ["--version"], { timeout: 10000 });
  firebaseCli = stdout.trim() || "installed";
} catch {
  firebaseCli = "not available in this shell";
  if (requireLive) warning("Firebase CLI was not available; deployment evidence still requires operator-supplied deploy proof.");
}

const generatedAt = new Date().toISOString();
const envEvidence = Object.fromEntries(
  [...requiredEnv, ...shaEvidenceEnv].map((name) => [
    name,
    {
      present: Boolean(process.env[name]),
      redacted: redact(process.env[name]),
      sha256: process.env[name] ? hashValue(process.env[name]) : ""
    }
  ])
);

const booleanControlEvidence = Object.fromEntries(
  booleanEvidenceEnv.map((name) => [name, yesNo(process.env[name])])
);

const shaControlEvidence = Object.fromEntries(
  shaEvidenceEnv.map((name) => [name, process.env[name] ? "present" : "missing"])
);

const markdown = `# URAI Privacy Staging Deployment Evidence\n\nGenerated: ${generatedAt}\n\nThis evidence file is intentionally redacted. Do not paste Firebase tokens, service-account JSON, private keys, cookies, session values, or user personal data.\n\n## Release identity\n\n- Release SHA: ${process.env.URAI_PRIVACY_RELEASE_SHA || "MISSING"}\n- Operator: ${process.env.URAI_PRIVACY_OPERATOR || "MISSING"}\n- Firebase project ID: ${process.env.URAI_PRIVACY_FIREBASE_PROJECT_ID || "MISSING"}\n- Hosting URL: ${baseUrl ? baseUrl.origin : "MISSING"}\n- Functions region: ${process.env.URAI_PRIVACY_FUNCTIONS_REGION || "MISSING"}\n- Firebase CLI: ${firebaseCli}\n\n## Required command evidence\n\nRun from a clean checkout of the release SHA:\n\n\`\`\`bash\nnpm run verify:release\nURAI_PRIVACY_BASE_URL="https://<staging-host>" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live\nURAI_PRIVACY_REQUIRE_LIVE=1 npm run release:evidence:staging\n\`\`\`\n\n## Redacted environment proof\n\n| Variable | Present | Redacted value | SHA-256 proof |\n| --- | --- | --- | --- |\n${Object.entries(envEvidence).map(([name, item]) => `| ${name} | ${item.present ? "yes" : "no"} | ${item.redacted || ""} | ${item.sha256 || ""} |`).join("\n")}\n\n## Deployment controls\n\n| Control | Status |\n| --- | --- |\n${Object.entries(booleanControlEvidence).map(([name, status]) => `| ${name} | ${status} |`).join("\n")}\n${Object.entries(shaControlEvidence).map(([name, status]) => `| ${name} | ${status} |`).join("\n")}\n\n## Live smoke checklist\n\n- [ ] Public routes smoke passed.\n- [ ] Owner export request passed.\n- [ ] Export signed URL retrieval passed.\n- [ ] Owner deletion request passed.\n- [ ] Deletion dry-run passed.\n- [ ] Deletion execute passed with current plan hash.\n- [ ] Legal hold blocks deletion.\n- [ ] Consent update passed.\n- [ ] Admin denied without claim.\n- [ ] Admin allowed with claim.\n- [ ] Anonymous access denied.\n- [ ] Cross-user data access denied.\n\n## Operator notes\n\n- Firebase deploy command used:\n- Auth provider proof location:\n- Admin custom-claim proof location:\n- Firestore rules deploy proof location:\n- Storage rules deploy proof location:\n- Monitoring dashboard/alert proof location:\n- Rollback proof location:\n- Legal/privacy approval location:\n\n## Release decision\n\n- Ship / No ship:\n- Decision owner:\n- Decision timestamp:\n- Remaining blockers:\n`;

await mkdir(evidenceDir, { recursive: true });
const path = `${evidenceDir}/STAGING_DEPLOYMENT_EVIDENCE.md`;
await writeFile(path, markdown, "utf8");
console.log(`[staging-evidence] wrote ${path}`);

const missingRequired = requiredEnv.filter((name) => !process.env[name]);
const incompleteBooleanControls = booleanEvidenceEnv.filter((name) => yesNo(process.env[name]) !== "yes");
const missingShaControls = shaEvidenceEnv.filter((name) => !process.env[name]);
if (requireLive && (missingRequired.length > 0 || incompleteBooleanControls.length > 0 || missingShaControls.length > 0)) {
  if (missingRequired.length > 0) console.error(`[staging-evidence] missing required env: ${missingRequired.join(", ")}`);
  if (incompleteBooleanControls.length > 0) console.error(`[staging-evidence] incomplete boolean controls: ${incompleteBooleanControls.join(", ")}`);
  if (missingShaControls.length > 0) console.error(`[staging-evidence] missing SHA controls: ${missingShaControls.join(", ")}`);
  process.exit(1);
}

if (missingRequired.length > 0 || incompleteBooleanControls.length > 0 || missingShaControls.length > 0) {
  warning("evidence template generated, but live release is not complete until every required field/control is filled and verified");
} else {
  console.log("[staging-evidence] OK: required environment and control evidence are present");
}
