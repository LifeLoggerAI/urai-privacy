/** Exact Cloud Storage generation identity, never coercing to JavaScript Number. */
export const MAX_GCS_GENERATION = 9223372036854775807n;

export function canonicalGcsGeneration(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw)) return null;
  try {
    const generation = BigInt(raw);
    return generation <= MAX_GCS_GENERATION && String(generation) === raw ? raw : null;
  } catch {
    return null;
  }
}

export function matchingGcsGeneration(expected: unknown, observed: unknown): string | null {
  const approved = canonicalGcsGeneration(expected);
  return approved && canonicalGcsGeneration(observed) === approved ? approved : null;
}

export function matchingExportObjectMetadata(expected: {
  generation: unknown;
  sha256: unknown;
}, observed: { generation?: unknown; metadata?: unknown }): string | null {
  const generation = matchingGcsGeneration(expected.generation, observed?.generation);
  if (!generation || typeof expected.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(expected.sha256)) return null;
  const custom = observed?.metadata;
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return null;
  const field = Object.getOwnPropertyDescriptor(custom, "sha256");
  return field && Object.hasOwn(field, "value") && field.value === expected.sha256 ? generation : null;
}

/** Reject wrong object names, traversal, or mismatched owner/job. */
export function exactExportArtifactPath(uid: string, jobId: string, path: unknown): path is string {
  if (!uid || !jobId || [uid, jobId].some(s => s.includes("/") || s.includes(".."))) return false;
  if (typeof path !== "string" || path.includes("..")) return false;
  const prefix = `exports/${uid}/${jobId}/`;
  if (!path.startsWith(prefix)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:export|manifest)\.json$/.test(path.slice(prefix.length));
}

/** Only the exact approved owner/job/path and recorded generation may be erased. */
export function approvedExportCleanupGeneration(args: {
  uid: string;
  jobId: string;
  path: unknown;
  exportPath: unknown;
  manifestPath: unknown;
  exportGeneration: unknown;
  manifestGeneration: unknown;
}): string | null {
  const { uid, jobId, path, exportPath, manifestPath, exportGeneration, manifestGeneration } = args;
  if (!exactExportArtifactPath(uid, jobId, path)) return null;
  const approved = path === exportPath ? exportGeneration : path === manifestPath ? manifestGeneration : null;
  return canonicalGcsGeneration(approved);
}
