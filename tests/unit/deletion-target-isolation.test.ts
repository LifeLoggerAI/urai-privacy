import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => {
  const rows = new Map<string, Row>();
  const versions = new Map<string, { seconds: number; nanoseconds: number }>();
  let revision = 0;
  const put = (path: string, row: Row) => {
    rows.set(path, row);
    versions.set(path, { seconds: 1000, nanoseconds: ++revision });
  };
  return {
  rows, versions, put,
  objects: new Map<string, { body: string; generation: string }>(),
  serial: 0,
  generation: 0,
  authDeletes: [] as string[],
  afterDeletionAudit: undefined as (() => void) | undefined,
  beforeDestructiveCommit: undefined as (() => void) | undefined,
  beforeStorageDelete: undefined as (() => void) | undefined,
  deleted: [] as string[],
  transactionDeleteSizes: [] as number[],
  authCreatedAt: "2026-10-01T00:00:00.000Z",
  authExists: true,
  adminAuthorized: true,
  adminRolePresent: true,
  adminUid: "admin-a",
  beforeTargetRead: undefined as (() => void) | undefined
  };
});
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
    data: () => state.rows.get(path) && { ...state.rows.get(path) }, ref: reference(path), updateTime: state.versions.get(path)
  });
  const reference = (path: string): any => ({
    path, id: path.split("/").at(-1), get: async () => snapshot(path),
    update: async (patch: Row) => state.put(path, apply(state.rows.get(path) ?? {}, patch)),
    set: async (row: Row) => {
      state.put(path, row);
      if (row.action === "deletion_execute_started") state.afterDeletionAudit?.();
    }
  });
  const query = (path: string): any => {
    const filters: Array<[string, unknown]> = []; let cursor = ""; let limit = Infinity;
    const result: any = {
      collectionPath: path,
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
        const reads = new Map<string, { row: Row | undefined; version: unknown }>();
        const queryReads = new Map<string, Array<[string, Row]>>();
        const writes: Array<{ path: string; patch: Row; merge: boolean }> = [];
        const targets: string[] = [];
        const result = await handler({
          get: async (ref: { path?: string; collectionPath?: string; get?: () => Promise<unknown> }) => {
            if (ref.path) {
              if (ref.path === "privacyRequests/owned") { state.beforeTargetRead?.(); state.beforeTargetRead = undefined; }
              reads.set(ref.path, { row: state.rows.get(ref.path), version: state.versions.get(ref.path) }); return snapshot(ref.path); }
            queryReads.set(ref.collectionPath!, [...state.rows].filter(([path]) => path.startsWith(ref.collectionPath! + "/")));
            return ref.get!();
          },
          update: (ref: { path: string }, patch: Row) => writes.push({ path: ref.path, patch, merge: true }),
          set: (ref: { path: string }, patch: Row, options?: { merge: boolean }) => writes.push({ path: ref.path, patch, merge: options?.merge ?? false }),
          delete: (ref: { path: string }) => targets.push(ref.path)
        });
        if (targets.length) { state.beforeDestructiveCommit?.(); state.beforeDestructiveCommit = undefined; }
        if ([...reads].some(([path, original]) => (state.rows.get(path) !== original.row || state.versions.get(path) !== original.version))
          || [...queryReads].some(([prefix, original]) => {
            const current = [...state.rows].filter(([path]) => path.startsWith(prefix + "/"));
            return original.length !== current.length || original.some(([path, row], index) => current[index]?.[0] !== path || current[index]?.[1] !== row);
          })) continue;
        for (const write of writes) state.put(write.path, apply(write.merge ? state.rows.get(write.path) ?? {} : {}, write.patch));
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
const authMock = vi.hoisted(() => ({ getAuth: () => ({
  verifyIdToken: async () => ({ uid: state.adminUid, admin: state.adminAuthorized }),
  getUser: async (uid: string) => {
    if (uid === "admin-a" || uid === state.adminUid) return { uid, disabled: false, customClaims: { admin: state.adminRolePresent }, metadata: { creationTime: "2026-09-01T00:00:00.000Z" } };
    if (!state.authExists) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
    return { uid, metadata: { creationTime: state.authCreatedAt } };
  },
  deleteUser: async (uid: string) => { state.authDeletes.push(uid); state.authExists = false; }
}) }));
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
  auth: admin, rawRequest: { get: (name: string) => name.toLowerCase() === "authorization" ? "Bearer synthetic-admin-token" : undefined },
  data: { requestId: "delete-a", mode, expectedPlanHash }
});
async function approve() { return (await run(request("dryRun"))).planHash as string; }
beforeEach(() => {
  state.rows.clear(); state.versions.clear(); state.objects.clear(); state.serial = 0; state.generation = 1;
  state.authCreatedAt = "2026-10-01T00:00:00.000Z"; state.authExists = true;
  state.adminAuthorized = true; state.adminRolePresent = true; state.adminUid = "admin-a"; state.beforeTargetRead = undefined;
  state.authDeletes = []; state.deleted = []; state.transactionDeleteSizes = [];
  state.afterDeletionAudit = undefined; state.beforeDestructiveCommit = undefined; state.beforeStorageDelete = undefined;
  state.put("deletionRequests/delete-a", { uid: "user-a", scope: "account", status: "processing" });
  state.put("users/user-a", { name: "synthetic owner" });
  state.put("privacyRequests/owned", { uid: "user-a" });
  state.put("privacyRequests/foreign", { uid: "user-b" });
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
    state.afterDeletionAudit = () => state.put("privacyRequests/owned", { uid: "user-b", restored: true });
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.rows.get("privacyRequests/owned")).toEqual({ uid: "user-b", restored: true });
    expect(state.authDeletes).toEqual([]);
  });
  it("refuses owner reassignment racing the destructive transaction commit", async () => {
    const hash = await approve();
    state.beforeDestructiveCommit = () => state.put("privacyRequests/owned", { uid: "user-b", restored: true });
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
    for (let index = 0; index < 901; index++) state.put(`privacyRequests/item-${String(index).padStart(4, "0")}`, { uid: "user-a" });
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



describe("approved deletion version and live execution authority", () => {
  for (const change of ["corrected", "rewritten"]) {
    it(`preserves an owner target ${change} after dry-run approval`, async () => {
      const hash = await approve();
      const original = state.rows.get("privacyRequests/owned")!;
      state.put("privacyRequests/owned", change === "corrected" ? { ...original, corrected: true } : original);
      await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
      expect(state.rows.has("privacyRequests/owned")).toBe(true);
      expect(state.authDeletes).toEqual([]);
    });
  }
  it("preserves same-owner corrections made during the deletion audit await", async () => {
    const hash = await approve();
    state.afterDeletionAudit = () => state.put("privacyRequests/owned", { uid: "user-a", corrected: true });
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.rows.get("privacyRequests/owned")).toEqual({ uid: "user-a", corrected: true });
    expect(state.authDeletes).toEqual([]);
  });
  it("preserves same-owner rewrites racing the atomic delete commit", async () => {
    const hash = await approve();
    state.beforeDestructiveCommit = () => state.put("privacyRequests/owned", state.rows.get("privacyRequests/owned")!);
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.rows.has("privacyRequests/owned")).toBe(true);
  });
  it("refuses authentication identity recreation after approval", async () => {
    const hash = await approve(); state.authCreatedAt = "2026-10-02T00:00:00.000Z";
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.rows.has("privacyRequests/owned")).toBe(true);
    expect(state.authDeletes).toEqual([]);
  });
  it("rechecks authentication identity after physical Storage deletion awaits", async () => {
    const path = "exports/user-a/job-a/export.json";
    state.objects.set(path, { body: "approved", generation: "1" });
    const hash = await approve();
    state.beforeStorageDelete = () => { state.authCreatedAt = "2026-10-02T00:00:00.000Z"; };
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.authDeletes).toEqual([]);
  });
  for (const change of ["cancelled", "subject-changed", "fence-withdrawn", "attempt-replaced", "lease-expired", "legal-hold"]) {
    it(`stops before another destructive batch when execution is ${change}`, async () => {
      const hash = await approve();
      state.afterDeletionAudit = () => {
        const operation = state.rows.get("deletionRequests/delete-a")!;
        if (change === "cancelled") state.put("deletionRequests/delete-a", { ...operation, status: "rejected" });
        else if (change === "subject-changed") state.put("deletionRequests/delete-a", { ...operation, uid: "user-b" });
        else if (change === "attempt-replaced") state.put("deletionRequests/delete-a", { ...operation, deletionExecutionAttemptToken: "successor" });
        else if (change === "lease-expired") state.put("deletionRequests/delete-a", { ...operation, deletionExecutionLeaseUntil: new Date(Date.now() - 1) });
        else if (change === "fence-withdrawn") state.put("privacyDeletionTombstones/user-a", { uid: "user-a", requestId: "delete-a", active: false });
        else state.put("legalHoldRecords/new-hold", { uid: "user-a", status: "active" });
      };
      await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "failed-precondition" });
      expect(state.rows.has("privacyRequests/owned")).toBe(true);
      expect(state.authDeletes).toEqual([]);
      if (change === "cancelled") expect(state.rows.get("deletionRequests/delete-a")?.status).toBe("rejected");
      if (change === "subject-changed") expect(state.rows.get("deletionRequests/delete-a")?.uid).toBe("user-b");
      if (change === "attempt-replaced") expect(state.rows.get("deletionRequests/delete-a")?.deletionExecutionAttemptToken).toBe("successor");
    });
  }
});


describe("current deletion actor after awaited Firestore reads", () => {
  it("withholds all destructive writes after administrative role removal during the audit await", async () => {
    const hash = await approve(); state.afterDeletionAudit = () => { state.adminAuthorized = false; };
    await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "permission-denied" });
    expect(state.rows.has("privacyRequests/owned")).toBe(true); expect(state.authDeletes).toEqual([]);
  });
  for (const change of ["role", "identity"]) {
    it(`withholds an atomic deletion if the actor ${change} changes while target reads await`, async () => {
      const hash = await approve();
      state.beforeTargetRead = () => { if (change === "role") state.adminAuthorized = false; else state.adminUid = "other-admin"; };
      await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "permission-denied" });
      expect(state.rows.has("privacyRequests/owned")).toBe(true); expect(state.authDeletes).toEqual([]);
    });
  }
});


it("rejects a still-valid administrative JWT after the provider-side role is removed", async () => {
  const hash = await approve();
  state.beforeTargetRead = () => { state.adminRolePresent = false; };
  await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "permission-denied" });
  expect(state.rows.has("privacyRequests/owned")).toBe(true); expect(state.authDeletes).toEqual([]);
});

it("retries an interrupted physical Storage deletion using the same approved versions", async () => {
  const path = "exports/user-a/job-a/export.json";
  state.objects.set(path, { body: "approved", generation: "1" });
  const hash = await approve();
  state.beforeStorageDelete = () => { state.beforeStorageDelete = undefined; throw new Error("synthetic Storage outage"); };
  await expect(run(request("execute", hash))).rejects.toMatchObject({ code: "internal" });
  expect(state.objects.has(path)).toBe(true); expect(state.authDeletes).toEqual([]);
  const result = await run(request("execute", hash));
  expect(result.verificationRequired).toBe(true); expect(state.objects.has(path)).toBe(false);
  expect(state.authDeletes).toEqual(["user-a"]); expect(state.rows.has("privacyRequests/foreign")).toBe(true);
});
