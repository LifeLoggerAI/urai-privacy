/** Pure export redaction and lease checks. No Firebase runtime or Cloud Function imports.
 * Shared between the production export worker and browser-side unit tests.
 * Do not expand into an authorization service; the worker owns server authority.
 */
const sensitiveFieldMarkers = [
  "password",
  "token",
  "secret",
  "apikey",
  "privatekey",
  "credential",
  "authorization",
  "cookie",
  "sessionkey",
  "webhooksignature"
] as const;

export function shouldRedactExportField(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return sensitiveFieldMarkers.some((marker) => normalized.includes(marker));
}

export function scrubExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubExportValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !shouldRedactExportField(key))
        .map(([key, nested]) => [key, scrubExportValue(nested)])
    );
  }
  return value;
}

export function processingLeaseIsActive(value: unknown, nowMs = Date.now()) {
  if (!value || typeof value !== "object" || !("toMillis" in value) || typeof value.toMillis !== "function") {
    return false;
  }
  return value.toMillis() > nowMs;
}

