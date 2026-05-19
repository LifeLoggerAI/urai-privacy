#!/usr/bin/env node
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = process.env.URAI_PRIVACY_BASE_URL;
const requireLive = process.env.URAI_PRIVACY_REQUIRE_LIVE === "1";

const routes = [
  "/",
  "/privacy",
  "/privacy-center",
  "/privacy-center/export",
  "/privacy-center/delete",
  "/privacy-center/consent",
  "/privacy-center/audit-log",
  "/privacy-center/retention",
  "/admin",
  "/admin/privacy-requests",
  "/admin/audit-log",
  "/admin/policies",
  "/admin/retention"
];

function fail(message) {
  console.error(`[smoke-live] ${message}`);
  process.exit(1);
}

if (!baseUrl) {
  const message = "URAI_PRIVACY_BASE_URL is not set; skipping live smoke. Set URAI_PRIVACY_REQUIRE_LIVE=1 to make this blocking.";
  if (requireLive) fail(message);
  console.warn(`[smoke-live] ${message}`);
  process.exit(0);
}

let parsedBase;
try {
  parsedBase = new URL(baseUrl);
} catch {
  fail(`URAI_PRIVACY_BASE_URL is invalid: ${baseUrl}`);
}

if (!/^https?:$/.test(parsedBase.protocol)) fail("URAI_PRIVACY_BASE_URL must be http(s)");

const failures = [];

async function fetchRoute(pathname, attempt = 1) {
  const url = new URL(pathname, parsedBase).toString();
  try {
    const response = await fetch(url, { redirect: "manual" });
    const text = await response.text();
    const okStatus = response.status >= 200 && response.status < 400;
    const hasHtml = text.includes("<html") || text.includes("URAI Privacy") || text.includes("__next");
    if (!okStatus) failures.push(`${pathname}: HTTP ${response.status}`);
    if (!hasHtml) failures.push(`${pathname}: response did not look like rendered app HTML`);
    if (/serviceAccount|PRIVATE KEY|firebase_private_key|AIza[0-9A-Za-z_-]{20,}/.test(text)) failures.push(`${pathname}: response may expose secret-looking material`);
    console.log(`[smoke-live] ${pathname} -> ${response.status}`);
  } catch (error) {
    if (attempt < 3) {
      await delay(750 * attempt);
      return fetchRoute(pathname, attempt + 1);
    }
    failures.push(`${pathname}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const route of routes) {
  await fetchRoute(route);
}

if (failures.length > 0) {
  console.error("[smoke-live] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[smoke-live] OK: ${routes.length} routes passed against ${parsedBase.origin}`);
