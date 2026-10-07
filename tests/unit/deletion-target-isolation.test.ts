import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  rows: new Map<string, Row>(),
  objects: new Map<string, { body: string; generation: string }>(),
  serial: 0,
  generation: 0,
  authDeletes: [] as string[],
  afterDeletionAudit: undefined as (() => void) | undefined,
  beforeDestructiveCommit: undefined as (() => void) | undefined,
  beforeStorageDelete: undefined as (() => void) | undefined,
  deleted: [] as string[],
  transactionDeleteSizes: [] as number[]
}));
const httpsMock = vi.hoisted(() => ({
  onCall: (handler: unknown) => handler,
  HttpsError: class extends Error {
    constructor(public code: string, message: string, public details?: unknown) { super(message); }
  }
}));
const firestoreMock = vi.hoisted(() => {
  const DELETE = { delete: true };
  const apply = (previous: Row, patch: Row) => {
    const next = { ...previous };
    for (const [key, value] of Object.entries(patch)) {
      if (value === DELETE) delete next[key]; else next[key] = value;
    }
    return next;
  };
  const snapshot = (path: string): any => ({
    exists: state.rows.has(path), id: path.split("/").at(-1),
    data: () => state.rows.get(path) && { ...state.rows.get(path) }, ref: reference(path)
  });
  const reference = (path: string): any => ({
    path, id: path.split("/").at(-1), get: async () => snapshot(path),
    update: async (patch: Row) => state.rows.set(path, apply(state.rows.get(path) ?? {}, patch)),
    set: async (row: Row) => {
      state.rows.set(path, row);
      if (row.action === "deletion_execute_started") state.afterDeletionAudit?.();
    }
  });
  const query = (path: string): any => {
    const filters: Array<[string, unknown]> = []; let cursor = ""; let limit = Infinity;
    const result: any = {
      doc: (id?: string) => reference(`${path}/${id ?? `generated-${++state.serial}`}`),
      where: (field: string, _operator: string, value: unknown) => { filters.push([field, value]); return result; },
      orderBy: () => result,
      startAfter: (id: string) => { cursor = id; return result; },
      limit: (value: number) => { limit = value; return result; },
      get: async () => {
        const docs = [...state.rows.keys()].filter(key => key.startsWith(path + "/")
          && !key.slice(path.length + 1).includes("/") && key.split("/").at(-1)! > cursor
          && filters.every(([field, value]) => state.rows.get(key)?.[field] === value))
          .sort().slice(0, limit).map(snapshot);
        return { docs, size: docs.length, empty: docs.length === 0 };
      }
    };
    return result;
  };
  const db = {
    collection: query,
    batch: () => {
      const targets: string[] = [];
      return {
        delete: (ref: { path: string }) => targets.push(ref.path),
        commit: async () => {
          state.beforeDestructiveCommit?.(); state.beforeDestructiveCommit = undefined;
          for (const path of targets) { state.rows.delete(path); state.deleted.push(path); }
        }
      };
    },
    runTransaction: async (handler: (tx: unknown) => Promise<unknown>) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const reads = new Map<string, Row | undefined>();
        const writes: Array<{ path: string; patch: Row; merge: boolean }> = [];
        const targets: string[] = [];
        const result = await handler({
          get: async (ref: { path: string }) => { reads.set(ref.path, state.rows.get(ref.path)); return snapshot(ref.path); },
          update: (ref: { path: string }, patch: Row) => writes.push({ path: ref.path, patch, merge: true }),
          set: (ref: { path: string }, patch: Row, options?: { merge: boolean }) => writes.push({ path: ref.path, patch, merge: options?.merge ?? false }),
          delete: (ref: { path: string }) => targets.push(ref.path)
        });
        if (targets.length) { state.beforeDestructiveCommit?.(); state.beforeDestructiveCommit = undefined; }
        if ([...reads].some(([path, original]) => state.rows.get(path) !== original)) continue;
        for (const write of writes) state.rows.set(write.path, apply(write.merge ? state.rows.get(write.path) ?? {} : {}, write.patch));
        for (const path of targets) { state.rows.delete(path); state.deleted.push(path); }
        if (targets.length) state.transactionDeleteSizes.push(targets.length);
        return result;
      }
      throw new Error("Synthetic transaction contention");
    }
  };
  return {
    getFirestore: () => db, FieldPath: { documentId: () => "__name__" },
    FieldValue: { serverTimestamp: () => new Date(), delete: () => DELETE },
    Timestamp: { fromDate: (date: Date) => date, fromMillis: (value: number) => new Date(value) }
  };
});
const storageMock = vi.hoisted(() => ({
  getStorage: () => ({ bucket: () => ({
    getFiles: async ({ prefix }: { prefix: string }) => [[...state.objects]
      .filter(([name]) => name.startsWith(prefix)).map(([name, object]) => ({ name, metadata: { generation: object.generation } }))],
    file: (path: string) => ({
      save: async (body: string) => state.objects.set(path, { body, generation: String(++state.generation) }),
      download: async () => [Buffer.from(state.objects.get(path)!.body)],
      getMetadata: async () => [{ generation: state.objects.get(path)!.generation }],
      delete: async (options?: { ifGenerationMatch?: string | number }) => {
        state.beforeStorageDelete?.(); state.beforeStorageDelete = undefined;
        if (options?.ifGenerationMatch !== undefined && String(options.ifGenerationMatch) !== state.objects.get(path)?.generation) {
          throw Object.assign(new Error("Generation changed"), { code: 412 });
        }
        state.objects.delete(path); state.deleted.push(path);
      }
    })
  }) })
}));
const appMock = vi.hoisted(() => ({ initializeApp: () => ({}) }));
const authMock = vi.hoisted(() => ({ getAuth: () => ({ deleteUser: async (uid: string) => state.authDeletes.push(uid) }) }));
vi.mock("firebase-admin/app", () => appMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/app/index.js", () => appMock);
vi.mock("firebase-admin/firestore", () => firestoreMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => firestoreMock);
vi.mock("firebase-admin/storage", () => storageMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/storage/index.js", () => storageMock);
vi.mock("firebase-admin/auth", () => authMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/auth/index.js", () => authMock);
vi.mock("firebase-functions/v2/https", () => httpsMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/https.js", () => httpsMock);

import { executeDeletionRequest } from "../../functions/src/index";
const run = executeDeletionRequest as unknown as (request: unknown) => Promise<any>;
const admin = { uid: "admin-a", token: { admin: true } };
const request = (mode: "dryRun" | "execute", expectedPlanHash?: string) => ({
  auth: admin, data: { requestId: "delete-a", mode, expectedPlanHash }
});
async function approve() { return (await run(request("dryRun"))).planHash as string; }
beforeEach(() => {
  state.rows.clear(); state.objects.clear(); state.serial = 0; state.generation = 1;
  state.authDeletes = []; state.deleted = []; state.transactionDeleteSizes = [];
  state.afterDeletionAudit = undefined; state.beforeDestructiveCommit = undefined; state.beforeStorageDelete = undefined;
  state.rows.set("deletionRequests/delete-a", { uid: "user-a", status: "processing" });
  state.rows.set("users/user-a", { name: "synthetic owner" });
  state.rows.set("privacyRequests/owned", { uid: "user-a" });
  state.rows.set("privacyRequests/foreign", { uid: "user-b" });
});
describe("actual deletion callable target isolation", () => {
  it("removes current approved owner targets and preserves unrelated owners", async () => {
    await run(request("execute", await approve()));
    expect(state.rows.has("privacyRequests/owned")).toBe(false);
    expect(state.rows.get("privacyRequests/foreign")).toEqual({ uid: "user-b" });
    expect(state.authDeletes).toEqual(["user-a"]);
  });
  it("refuses an approved ID reassigned during the deletion audit await", async () => {
    const hash = await approve();
    state.afterDeletionAudit = () => state.rows.set("privacyRequests/owned", { uid: "user-b", restored: true });
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.rows.get("privacyRequests/owned")).toEqual({ uid: "user-b", restored: true });
    expect(state.authDeletes).toEqual([]);
  });
  it("refuses owner reassignment racing the destructive transaction commit", async () => {
    const hash = await approve();
    state.beforeDestructiveCommit = () => state.rows.set("privacyRequests/owned", { uid: "user-b", restored: true });
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.rows.get("privacyRequests/owned")).toEqual({ uid: "user-b", restored: true });
  });
  it("counts vanished targets as already removed instead of fabricating deletions", async () => {
    const hash = await approve();
    state.afterDeletionAudit = () => state.rows.delete("privacyRequests/owned");
    const result = await run(request("execute", hash));
    expect(result.deletedCounts.privacyRequests).toBe(0);
  });
  it("keeps large owner scopes in bounded destructive transactions", async () => {
    for (let index = 0; index < 901; index++) state.rows.set(`privacyRequests/item-${String(index).padStart(4, "0")}`, { uid: "user-a" });
    await run(request("execute", await approve()));
    expect(state.transactionDeleteSizes.length).toBeGreaterThan(2);
    expect(Math.max(...state.transactionDeleteSizes)).toBeLessThanOrEqual(450);
    expect(state.rows.get("privacyRequests/foreign")).toEqual({ uid: "user-b" });
  });
  it("refuses an export object replaced after the dry-run generation was approved", async () => {
    const path = "exports/user-a/job-a/export.json";
    state.objects.set(path, { body: "approved", generation: "1" });
    const hash = await approve();
    state.objects.set(path, { body: "replacement", generation: "2" });
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.objects.get(path)?.body).toBe("replacement");
  });
  it("preserves an export generation replaced during the physical Storage delete await", async () => {
    const path = "exports/user-a/job-a/export.json";
    state.objects.set(path, { body: "approved", generation: "1" });
    const hash = await approve();
    state.beforeStorageDelete = () => state.objects.set(path, { body: "replacement", generation: "2" });
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.objects.get(path)?.body).toBe("replacement");
    expect(state.authDeletes).toEqual([]);
  });
});
