export const MAX_CONSENT_GRANT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export type ConsentWriteStatus = "granted" | "denied" | "revoked";

export function resolveConsentExpiry(args: {
  status: ConsentWriteStatus;
  requestedExpiresAt?: string;
  nowMillis: number;
}): string | null {
  if (args.status !== "granted") return null;
  if (!Number.isFinite(args.nowMillis)) throw new Error("Consent grant time is invalid.");

  const maximumExpiry = args.nowMillis + MAX_CONSENT_GRANT_TTL_MS;
  if (!args.requestedExpiresAt) return new Date(maximumExpiry).toISOString();

  const requestedExpiry = Date.parse(args.requestedExpiresAt);
  if (!Number.isFinite(requestedExpiry) || requestedExpiry <= args.nowMillis) {
    throw new Error("Granted consent must expire in the future.");
  }

  return new Date(Math.min(requestedExpiry, maximumExpiry)).toISOString();
}
