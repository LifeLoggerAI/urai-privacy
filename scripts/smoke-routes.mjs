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

if (failures.length) {
  console.error("[smoke-routes] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[smoke-routes] OK: required product routes are present and renderable by convention");
