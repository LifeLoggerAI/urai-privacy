#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const requiredRoutes = [
  "app/page.tsx",
  "app/privacy/page.tsx",
  "app/privacy-center/page.tsx",
  "app/privacy-center/export/page.tsx",
  "app/privacy-center/delete/page.tsx",
  "app/privacy-center/retention/page.tsx",
  "app/privacy-center/consent/page.tsx",
  "app/privacy-center/audit-log/page.tsx",
  "app/admin/page.tsx",
  "app/admin/privacy-requests/page.tsx",
  "app/admin/audit-log/page.tsx",
  "app/admin/retention/page.tsx",
  "app/admin/policies/page.tsx"
];

const protectedLayouts = [
  { path: "app/admin/layout.tsx", requiresAdminGate: true },
  { path: "app/privacy-center/layout.tsx", requiresAdminGate: false }
];

const failures = [];
for (const route of requiredRoutes) {
  if (!existsSync(route)) {
    failures.push(`Missing route file: ${route}`);
    continue;
  }
  const text = readFileSync(route, "utf8");
  if (!text.includes("export default")) failures.push(`${route} does not export a default component`);
  if (text.includes("Lorem ipsum")) failures.push(`${route} contains placeholder lorem ipsum text`);
}

for (const layout of protectedLayouts) {
  if (!existsSync(layout.path)) {
    failures.push(`Missing protected route layout: ${layout.path}`);
    continue;
  }
  const text = readFileSync(layout.path, "utf8");
  if (!text.includes("index: false") || !text.includes("follow: false")) {
    failures.push(`${layout.path} must export noindex/nofollow metadata`);
  }
  if (layout.requiresAdminGate && !text.includes("<AdminGate>")) {
    failures.push(`${layout.path} must gate the complete admin route tree`);
  }
}

if (failures.length) {
  console.error("[smoke-routes] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[smoke-routes] OK: required product routes and protected route boundaries are present");
