import { describe, expect, it } from "vitest";

import {
  collectNestedRows,
  collectPaginatedRows,
  mapWithConcurrency,
  type PaginatedDocument
} from "../../functions/src/export-pagination";

type Row = PaginatedDocument<{ value: number }>;

function row(index: number): Row {
  return { id: `doc-${String(index).padStart(4, "0")}`, data: { value: index } };
}

describe("export pagination", () => {
  it("collects every page past two full Firestore-sized boundaries", async () => {
    const source = Array.from({ length: 901 }, (_, index) => row(index));
    const cursors: Array<string | null> = [];

    const rows = await collectPaginatedRows(async (cursor, limit) => {
      cursors.push(cursor);
      const start = cursor ? source.findIndex((item) => item.id === cursor) + 1 : 0;
      return source.slice(start, start + limit);
    }, 450);

    expect(rows).toEqual(source);
    expect(cursors).toEqual([null, "doc-0449", "doc-0899"]);
  });

  it("fails closed when a loader repeats a full-page cursor", async () => {
    const repeated = Array.from({ length: 450 }, (_, index) => row(index));

    await expect(collectPaginatedRows(async () => repeated, 450)).rejects.toThrow(
      "Pagination cursor did not advance."
    );
  });

  it("bounds nested traversal concurrency while preserving parent order", async () => {
    const parents = Array.from({ length: 12 }, (_, index) => ({ id: `event-${index}` }));
    let active = 0;
    let maxActive = 0;

    const groups = await mapWithConcurrency(parents, 3, async (parent) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return parent.id;
    });

    expect(groups).toEqual(parents.map((parent) => parent.id));
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("exports paginated nested acknowledgements with immutable parent identity", async () => {
    const parents = [{ id: "event-a" }, { id: "event-b" }];
    const children = new Map<string, Row[]>([
      ["event-a", Array.from({ length: 5 }, (_, index) => row(index))],
      ["event-b", [row(9)]]
    ]);

    const exported = await collectNestedRows({
      parents,
      concurrency: 2,
      loadChildren: (parent) => collectPaginatedRows(async (cursor, limit) => {
        const source = children.get(parent.id) ?? [];
        const start = cursor ? source.findIndex((item) => item.id === cursor) + 1 : 0;
        return source.slice(start, start + limit);
      }, 2),
      mapChild: (parent, child) => ({
        id: child.id,
        eventId: parent.id,
        parentPath: `consentRevocationOutbox/${parent.id}`,
        value: child.data.value
      })
    });

    expect(exported).toHaveLength(6);
    expect(exported.slice(0, 5).every((item) => item.eventId === "event-a")).toBe(true);
    expect(exported[5]).toEqual({
      id: "doc-0009",
      eventId: "event-b",
      parentPath: "consentRevocationOutbox/event-b",
      value: 9
    });
  });
});
