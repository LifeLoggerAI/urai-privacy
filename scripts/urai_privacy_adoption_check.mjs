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
  const content = read(path);
  if (!content.includes(needle)) failures.push(`${path} missing ${label}`);
}

function requireAnyContains(path, needles, label) {
  const content = read(path);
  if (!needles.some((needle) => content.includes(needle))) failures.push(`${path} missing ${label}`);
}

const requiredFiles = [
  "package.json",
  "firestore.rules",
  "storage.rules",
  "firebase.json",
  "privacy/PRIVACY_VERSION.md",
  "privacy/adoption-report.md",
  "privacy/data-inventory.yaml",
  "privacy/feature-manifests/README.md"
];

for (const file of requiredFiles) requireFile(file);

requireContains("privacy/PRIVACY_VERSION.md", "URAI Privacy", "privacy package name");
requireAnyContains("privacy/PRIVACY_VERSION.md", ["0.2.0", "control-plane", "staging-scaffold"], "current privacy version marker");
requireContains("privacy/adoption-report.md", "Status:", "adoption status");
requireContains("privacy/adoption-report.md", "Definition of Done", "Definition of Done checklist");
requireContains("privacy/data-inventory.yaml", "consent_tiers:", "consent tier mapping");
requireContains("privacy/data-inventory.yaml", "tier_0", "Tier 0 consent boundary");
requireContains("privacy/data-inventory.yaml", "tier_1", "Tier 1 consent boundary");
requireContains("privacy/data-inventory.yaml", "tier_2", "Tier 2 consent boundary");
requireContains("privacy/data-inventory.yaml", "tier_3", "Tier 3 consent boundary");
requireContains("privacy/data-inventory.yaml", "processors:", "third-party processor mapping");
requireContains("privacy/feature-manifests/README.md", "approved_with_conditions", "feature status model");
requireContains("privacy/feature-manifests/README.md", "blocked", "blocked feature status");
requireContains("firestore.rules", "match /{document=**}", "Firestore catch-all deny block");
requireContains("storage.rules", "match /{allPaths=**}", "Storage catch-all deny block");
requireContains("package.json", "audit:privacy", "audit:privacy npm script");
requireContains("package.json", "audit:tier-one", "audit:tier-one npm script");

const adoption = read("privacy/adoption-report.md");
const version = read("privacy/PRIVACY_VERSION.md");
const inventory = read("privacy/data-inventory.yaml");

if (/Status:\s*draft/i.test(adoption)) failures.push("adoption report status is draft");

if (/Privacy reviewer:\s*TBD/i.test(version) || /reviewer:\s*TBD/i.test(inventory)) {
  warnings.push("privacy reviewer is still TBD; production approval must remain blocked until signoff");
}

if (/Status:\s*blocked/i.test(adoption) || /production.*blocked/i.test(version)) {
  warnings.push("privacy package is intentionally blocked for production; audit passes structural readiness only");
}

if (/data_stores:\s*\[\]/.test(inventory)) failures.push("data inventory has empty data_stores");
if (/fields:\s*\[\]/.test(inventory)) failures.push("data inventory has empty fields");
if (/processors:\s*\[\]/.test(inventory)) failures.push("data inventory has empty processors");

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

const publicFiles = [
  "app/privacy/page.tsx",
  "app/privacy-center/page.tsx",
  "app/page.tsx"
].filter(existsSync);

for (const file of publicFiles) {
  const lower = read(file).toLowerCase();
  for (const claim of bannedClaims) {
    if (lower.includes(claim.toLowerCase())) failures.push(`${file} contains banned claim: ${claim}`);
  }
}

if (failures.length > 0) {
  console.error("[audit:privacy] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`[audit:privacy] warning: ${warning}`);
console.log("[audit:privacy] ok");
