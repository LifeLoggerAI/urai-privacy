export const EXPORT_PAGE_SIZE = 500;
export const EXPORT_SCHEMA_VERSION = "1.0.0";

export const EXPORT_SOURCES = [
  { collection: "privacyRequests", field: "uid" },
  { collection: "exportJobs", field: "uid" },
  { collection: "deletionRequests", field: "uid" },
  { collection: "consentRecords", field: "uid" },
  { collection: "consentEvents", field: "uid" },
  { collection: "consentDecisions", field: "uid" },
  { collection: "dataAccessEvents", field: "uid" },
  { collection: "auditLogs", field: "targetUid" },
  { collection: "adminActions", field: "targetUid" },
  { collection: "legalHoldRecords", field: "uid" }
] as const;

const blockedFieldNames = new Set([
  "password",
  "token",
  "secret",
  "apikey",
  "privatekey",
  "refreshtoken",
  "idtoken",
  "accesstoken",
  "sessiontoken",
  "authorization",
  "cookie"
]);

function normalizedFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isBlockedExportField(fieldName: string) {
  return blockedFieldNames.has(normalizedFieldName(fieldName));
}

export function blockedExportFields() {
  return [...blockedFieldNames].sort();
}

function timestampIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== "object") return null;

  const candidate = value as { toDate?: unknown };
  if (typeof candidate.toDate !== "function") return null;

  try {
    const converted = candidate.toDate();
    return converted instanceof Date ? converted.toISOString() : null;
  } catch {
    return null;
  }
}

export function serializeForExport(value: unknown): unknown {
  const timestamp = timestampIso(value);
  if (timestamp) return timestamp;

  if (Array.isArray(value)) {
    return value.map((entry) => serializeForExport(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isBlockedExportField(key))
        .map(([key, entry]) => [key, serializeForExport(entry)])
    );
  }

  return value;
}

export async function collectAllPages<TDocument, TRow>(args: {
  fetchPage: (cursor: TDocument | null, pageSize: number) => Promise<TDocument[]>;
  mapDocument: (document: TDocument) => TRow;
  pageSize?: number;
}): Promise<TRow[]> {
  const pageSize = args.pageSize ?? EXPORT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("Export page size must be a positive safe integer.");
  }

  const rows: TRow[] = [];
  let cursor: TDocument | null = null;

  while (true) {
    const page = await args.fetchPage(cursor, pageSize);
    if (page.length === 0) break;

    rows.push(...page.map(args.mapDocument));
    cursor = page[page.length - 1] ?? null;

    if (page.length < pageSize) break;
  }

  return rows;
}

export function summarizeExportCollections(
  collections: Record<string, Array<Record<string, unknown>>>
) {
  const collectionCounts = Object.fromEntries(
    Object.entries(collections).map(([name, rows]) => [name, rows.length])
  );
  const recordCount = Object.values(collectionCounts).reduce(
    (total, count) => total + count,
    0
  );

  return { collectionCounts, recordCount };
}
