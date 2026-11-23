export const EXPORT_DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;
export const EXPORT_PACKAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const EXPORT_CLEANUP_PAGE_SIZE = 100;
export const EXPORT_CLEANUP_MAX_PAGES = 20;

function finiteMillis(value: number) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function timestampMillis(value: unknown): number | null {
  if (typeof value === "number") return finiteMillis(value);
  if (typeof value === "string") return finiteMillis(Date.parse(value));
  if (value instanceof Date) return finiteMillis(value.getTime());
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    toMillis?: unknown;
    toDate?: unknown;
    seconds?: unknown;
    nanoseconds?: unknown;
  };

  if (typeof candidate.toMillis === "function") {
    try {
      return finiteMillis(candidate.toMillis());
    } catch {
      return null;
    }
  }

  if (typeof candidate.toDate === "function") {
    try {
      const date = candidate.toDate();
      return date instanceof Date ? finiteMillis(date.getTime()) : null;
    } catch {
      return null;
    }
  }

  if (typeof candidate.seconds === "number") {
    const nanos = typeof candidate.nanoseconds === "number" ? candidate.nanoseconds : 0;
    return finiteMillis(candidate.seconds * 1000 + nanos / 1_000_000);
  }

  return null;
}

export function resolveExportPackageExpiry(job: Record<string, unknown>) {
  const explicit = timestampMillis(job.packageExpiresAt);
  if (explicit) return explicit;

  const completedAt = timestampMillis(job.completedAt);
  return completedAt ? completedAt + EXPORT_PACKAGE_TTL_MS : null;
}

// Fail closed if an export was cleaned, replaced or reprocessed during signing.
export function currentExportDownloadMatches(
  original: Record<string, unknown>,
  latest: Record<string, unknown> | null,
  now = Date.now()
) {
  if (!latest || original.status !== "completed" || original.complete !== true ||
      latest.status !== "completed" || latest.complete !== true) return false;
  for (const name of [
    "uid", "requestId", "exportPackagePath", "exportManifestPath",
    "exportSha256", "manifestSha256"
  ] as const) {
    if (typeof original[name] !== "string" || !original[name] ||
        original[name] !== latest[name]) return false;
  }
  const before = resolveExportPackageExpiry(original);
  const after = resolveExportPackageExpiry(latest);
  return before !== null && after === before && after > now;
}

export function isExportPackageExpired(job: Record<string, unknown>, now = Date.now()) {
  const expiresAt = resolveExportPackageExpiry(job);
  return expiresAt !== null && expiresAt <= now;
}

export function validExportObjectPath(args: {
  uid: string;
  jobId: string;
  path: unknown;
}) {
  return (
    typeof args.path === "string" &&
    args.path.startsWith(`exports/${args.uid}/${args.jobId}/`) &&
    !args.path.includes("..")
  );
}
