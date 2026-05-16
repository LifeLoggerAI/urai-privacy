#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const failures = [];
const warnings = [];

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function requireFile(path) {
  if (!existsSync(path)) failures.push(`missing ${path}`);
}

function requireContains(path, needle, label = needle) {
  if (!read(path).includes(needle)) failures.push(`${path} missing ${label}`);
}

const files = [
  "privacy/feature-manifests/README.md",
  "privacy/adoption-report.md",
  "privacy/data-inventory.yaml"
];

for (const file of files) requireFile(file);

requireContains("privacy/feature-manifests/README.md", "Banned public claims", "banned claim section");
requireContains("privacy/feature-manifests/README.md", "synthetic", "synthetic demo boundary");
requireContains("privacy/feature-manifests/README.md", "Asset Factory", "Asset Factory boundary");
requireContains("privacy/adoption-report.md", "Synthetic/demo surfaces", "synthetic demo launch boundary");
requireContains("privacy/data-inventory.yaml", "tier_0", "Tier 0 public demo boundary");
requireContains("privacy/data-inventory.yaml", "synthetic_demo", "synthetic demo data boundary");

const bannedClaims = [
  "lie detection",
  "betrayal detection",
  "trust score",
  "predicts crisis",
  "diagnoses mood",
  "detects mental illness",
  "reads your face",
  "knows if someone is lying",
  "sells your emotional data",
  "AI therapist"
];

const scanFiles = [
  "app/page.tsx",
  "app/privacy/page.tsx",
  "app/privacy-center/page.tsx",
  "privacy/adoption-report.md",
  "privacy/feature-manifests/README.md"
].filter(existsSync);

for (const file of scanFiles) {
  const content = read(file).toLowerCase();
  for (const claim of bannedClaims) {
    const normalizedClaim = claim.toLowerCase();
    if (content.includes(normalizedClaim) && !file.startsWith("privacy/")) {
      failures.push(`${file} contains banned Tier One claim: ${claim}`);
    }
  }
}

if (read("privacy/adoption-report.md").includes("Status: blocked")) {
  warnings.push("Tier One audit passes structural safeguards, but production remains blocked by adoption report status.");
}

if (failures.length > 0) {
  console.error("[audit:tier-one] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`[audit:tier-one] warning: ${warning}`);
console.log("[audit:tier-one] ok");
