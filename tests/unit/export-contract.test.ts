import { describe, expect, it } from "vitest";
import {
  collectAllPages,
  EXPORT_PAGE_SIZE,
  EXPORT_SCHEMA_VERSION,
  EXPORT_SOURCES,
  isBlockedExportField,
  serializeForExport,
  summarizeExportCollections
} from "../../functions/src/export-contract";

describe("complete export contract", () => {
  it("includes consent evidence and uses a versioned bounded page size", () => {
    expect(EXPORT_SCHEMA_VERSION).toBe("1.0.0");
    expect(EXPORT_PAGE_SIZE).toBe(500);
    expect(EXPORT_SOURCES).toContainEqual({ collection: "consentEvents", field: "uid" });
    expect(EXPORT_SOURCES).toContainEqual({ collection: "consentDecisions", field: "uid" });
  });

  it("collects more than the former 1000-record ceiling without truncation", async () => {
    const documents = Array.from({ length: 1_201 }, (_, index) => ({
      id: `doc-${String(index).padStart(4, "0")}`,
      value: index
    }));
    const requestedCursors: Array<string | null> = [];

    const rows = await collectAllPages({
      fetchPage: async (cursor: { id: string; value: number } | null, pageSize) => {
        requestedCursors.push(cursor?.id ?? null);
        const start = cursor ? documents.findIndex((entry) => entry.id === cursor.id) + 1 : 0;
        return documents.slice(start, start + pageSize);
      },
      mapDocument: (document) => ({ id: document.id, value: document.value })
    });

    expect(rows).toHaveLength(1_201);
    expect(rows[0]).toEqual({ id: "doc-0000", value: 0 });
    expect(rows.at(-1)).toEqual({ id: "doc-1200", value: 1_200 });
    expect(requestedCursors).toEqual([null, "doc-0499", "doc-0999"]);
  });

  it("continues past an exact full page and terminates on the following empty page", async () => {
    const documents = Array.from({ length: 1_000 }, (_, index) => index);
    let fetches = 0;

    const rows = await collectAllPages({
      fetchPage: async (cursor: number | null, pageSize) => {
        fetches += 1;
        const start = cursor === null ? 0 : cursor + 1;
        return documents.slice(start, start + pageSize);
      },
      mapDocument: (document) => document
    });

    expect(rows).toHaveLength(1_000);
    expect(fetches).toBe(3);
  });

  it("recursively removes credential fields, including objects nested inside arrays", () => {
    const timestamp = { toDate: () => new Date("2026-07-06T08:00:00.000Z") };
    const serialized = serializeForExport({
      profile: {
        displayName: "Example",
        api_key: "must-not-export",
        nested: [{ accessToken: "must-not-export", kept: true, at: timestamp }]
      },
      cookie: "must-not-export",
      createdAt: timestamp
    });

    expect(serialized).toEqual({
      profile: {
        displayName: "Example",
        nested: [{ kept: true, at: "2026-07-06T08:00:00.000Z" }]
      },
      createdAt: "2026-07-06T08:00:00.000Z"
    });
    expect(isBlockedExportField("private-key")).toBe(true);
    expect(isBlockedExportField("ordinaryField")).toBe(false);
  });

  it("produces deterministic collection and total counts", () => {
    expect(
      summarizeExportCollections({
        users: [{ id: "user-1" }],
        consentDecisions: [{ id: "decision-1" }, { id: "decision-2" }],
        auditLogs: []
      })
    ).toEqual({
      collectionCounts: { users: 1, consentDecisions: 2, auditLogs: 0 },
      recordCount: 3
    });
  });

  it("rejects invalid page sizes", async () => {
    await expect(
      collectAllPages({
        fetchPage: async () => [],
        mapDocument: (document: never) => document,
        pageSize: 0
      })
    ).rejects.toThrow("positive safe integer");
  });
});
