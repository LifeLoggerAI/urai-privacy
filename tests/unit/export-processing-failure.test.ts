import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const fixture = vi.hoisted(() => ({
  documents: new Map<string, Row>(),
  objects: new Map<string, string>(),
  deletes: [] as string[],
  transactions: 0,
  saves: 0,
  nextId: 0,
  failSave: 0,
  failDeletes: false,
  failAudit: false,
  failAllAudits: false,
  losePublicationReply: false,
  failAttemptRead: false,
  authExists: false,
  failAuditTransaction: 0,
  beforeTransaction: undefined as ((phase: number) => void) | undefined,
  beforePublication: undefined as (() => void) | undefined
}));

const httpsMock = vi.hoisted(() => ({
  onCall: (_options: unknown, handler: unknown) => handler,
  HttpsError: class extends Error {
    code: string; details: unknown;
    constructor(code: string, message: string, details?: unknown) { super(message); this.code = code; this.details = details; }
  }
}));
vi.mock("firebase-functions/v2/https", () => httpsMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/https.js", () => httpsMock);

const firestoreMock = vi.hoisted(() => {
  const DELETE = { operation: "delete" };
  function apply(previous: Row, update: Row) {
    const row = { ...previous };
    for (const [key, value] of Object.entries(update)) {
      if (value === DELETE) delete row[key];
      else if (value && typeof value === "object" && "increment" in value) row[key] = Number(row[key] ?? 0) + Number(value.increment);
      else row[key] = value;
    }
    return row;
  }
  function snapshot(path: string) {
    const value = fixture.documents.get(path);
    return { exists: Boolean(value), id: path.split("/").at(-1), data: () => value && { ...value }, ref: docRef(path) };
  }
  function docRef(path: string): any {
    return {
      path, id: path.split("/").at(-1),
      get: async () => {
        if (fixture.failAttemptRead && path.startsWith("exportArtifactAttempts/")) throw new Error("private failure /internal/path");
        return snapshot(path);
      },
      set: async (update: Row, options?: { merge?: boolean }) => {
        fixture.documents.set(path, apply(options?.merge ? fixture.documents.get(path) ?? {} : {}, update));
      },
      collection: (name: string) => query(`${path}/${name}`)
    };
  }
  function query(path: string): any {
    const filters: Array<[string, string, unknown]> = [];
    const object = {
      doc: (id?: string) => docRef(`${path}/${id ?? `generated-${++fixture.nextId}`}`),
      where: (field: string, operator: string, value: unknown) => { filters.push([field, operator, value]); return object; },
      orderBy: () => object, limit: () => object, startAfter: () => object,
      get: async () => {
        const docs = [...fixture.documents.entries()]
          .filter(([key, value]) => key.startsWith(path + "/") && key.slice(path.length + 1).indexOf("/") < 0 && filters.every(([field, operator, expected]) => {
            if (operator === "<=") {
              const left = value[field] as { toMillis?: () => number } | undefined;
              const right = expected as { toMillis: () => number };
              return Boolean(left?.toMillis && left.toMillis() <= right.toMillis());
            }
            return value[field] === expected;
          }))
          .map(([key]) => snapshot(key));
        return { docs, size: docs.length, empty: !docs.length };
      }
    };
    return object;
  }
  const db = {
    collection: query,
    runTransaction: async (handler: (tx: unknown) => Promise<unknown>) => {
      fixture.transactions += 1;
      const phase = fixture.transactions;
      fixture.beforeTransaction?.(phase);
      if (phase === 2) fixture.beforePublication?.();
      const writes: Array<{ kind: string; path: string; data: Row; merge: boolean }> = [];
      const tx = {
        get: async (ref: { path: string }) => snapshot(ref.path),
        create: (ref: { path: string }, data: Row) => {
          if (ref.path.startsWith("auditLogs/") && (fixture.failAllAudits || fixture.failAuditTransaction === phase || fixture.failAudit && data.action === "export_processed")) {
            throw new Error("Audit write outage at /sensitive/provider/key");
          }
          writes.push({ kind: "create", path: ref.path, data, merge: false });
        },
        update: (ref: { path: string }, data: Row) => writes.push({ kind: "update", path: ref.path, data, merge: true }),
        set: (ref: { path: string }, data: Row, options?: { merge?: boolean }) => writes.push({ kind: "set", path: ref.path, data, merge: options?.merge ?? false })
      };
      const result = await handler(tx);
      for (const write of writes) {
        if (write.kind === "update" && !fixture.documents.has(write.path)) throw new Error("Missing document update");
        if (write.kind === "create" && fixture.documents.has(write.path)) throw new Error("Duplicate immutable document");
      }
      for (const write of writes) fixture.documents.set(write.path, apply(write.merge ? fixture.documents.get(write.path) ?? {} : {}, write.data));
      if (phase === 2 && fixture.losePublicationReply) throw new Error("Publication response lost at /private/path");
      return result;
    }
  };
  return {
    getFirestore: () => db,
    FieldPath: { documentId: () => "__name__" },
    FieldValue: { delete: () => DELETE, serverTimestamp: () => ({ toMillis: () => Date.now() }), increment: (increment: number) => ({ increment }) },
    Timestamp: { fromMillis: (millis: number) => ({ toMillis: () => millis }) }
  };
});
vi.mock("firebase-admin/firestore", () => firestoreMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => firestoreMock);

const storageMock = vi.hoisted(() => ({
  getStorage: () => ({ bucket: () => ({
    getFiles: async ({ prefix }: { prefix: string }) => [[...fixture.objects.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name }))],
    file: (path: string) => ({
    save: async (contents: string) => {
      fixture.saves += 1;
      if (fixture.saves === fixture.failSave) throw new Error("Storage outage /private/path");
      fixture.objects.set(path, contents);
    },
    delete: async () => {
      fixture.deletes.push(path);
      if (fixture.failDeletes) throw new Error("Storage deletion outage /private/path");
      fixture.objects.delete(path);
    }
  }) }) })
}));
vi.mock("firebase-admin/storage", () => storageMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/storage/index.js", () => storageMock);

const authMock = vi.hoisted(() => ({
  getAuth: () => ({ getUser: async () => {
    if (!fixture.authExists) throw { code: "auth/user-not-found" };
    return { uid: "user-a" };
  } })
}));
vi.mock("firebase-admin/auth", () => authMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/auth/index.js", () => authMock);

import { processExportRequest } from "../../functions/src/export-request";
import { cleanupExportArtifactAttempts } from "../../functions/src/export-attempt-maintenance";
import { collectDeletionCompletionResiduals } from "../../functions/src/deletion-completion-verifier";
const run = processExportRequest as unknown as (request: Row) => Promise<Row>;
const adminRequest = { auth: { uid: "admin-a", token: { admin: true } }, data: { jobId: "job-a" } };
function job() { return fixture.documents.get("exportJobs/job-a")!; }
function fence() { return fixture.documents.get("privacyDeletionTombstones/user-a")!; }
function attempt() { return [...fixture.documents.entries()].find(([path]) => path.startsWith("exportArtifactAttempts/"))!; }

beforeEach(() => {
  fixture.documents.clear(); fixture.objects.clear(); fixture.deletes = [];
  Object.assign(fixture, { transactions: 0, saves: 0, nextId: 0, failSave: 0, failDeletes: false, failAudit: false, failAllAudits: false, losePublicationReply: false, failAttemptRead: false, authExists: false, failAuditTransaction: 0, beforePublication: undefined, beforeTransaction: undefined });
  fixture.documents.set("exportJobs/job-a", { uid: "user-a", requestId: "request-a", status: "pending" });
  fixture.documents.set("privacyRequests/request-a", { uid: "user-a", type: "export", status: "pending" });
});

function seedExpiredAttempt(status = "processing") {
  const token = "00000000-0000-4000-8000-000000000001";
  const paths = [`exports/user-a/job-a/${token}/export.json`, `exports/user-a/job-a/${token}/manifest.json`];
  const now = Date.now();
  fixture.documents.set(`exportArtifactAttempts/${token}`, {
    uid: "user-a", jobId: "job-a", requestId: "request-a", token, paths, status,
    cleanupDueAt: { toMillis: () => now - 1 }
  });
  fixture.documents.set("exportJobs/job-a", {
    ...job(), status: "processing", processingBy: "admin-a", processingLeaseToken: token,
    processingLeaseExpiresAt: { toMillis: () => now - 1 }
  });
  fixture.documents.set("privacyRequests/request-a", { uid: "user-a", type: "export", status: "processing" });
  fixture.documents.set("privacyDeletionTombstones/user-a", {
    uid: "user-a", exportProcessingJobId: "job-a", exportProcessingLeaseToken: token,
    exportProcessingLeaseExpiresAt: { toMillis: () => now - 1 }
  });
  for (const path of paths) fixture.objects.set(path, "orphan-bytes");
  return { now, token, paths };
}

describe("export attempt maintenance recovery", () => {
  it("recovers crashed workers and clears the expired subject fence", async () => {
    const { now } = seedExpiredAttempt();
    expect(await cleanupExportArtifactAttempts(now)).toEqual({ cleaned: 1, failed: 0 });
    expect(job().status).toBe("failed"); expect(attempt()[1].status).toBe("cleaned");
    expect(fixture.objects.size).toBe(0); expect(fence()).not.toHaveProperty("exportProcessingLeaseToken");
  });
  it("retries failed Storage cleanup while preserving its exact paths", async () => {
    const { now } = seedExpiredAttempt(); fixture.failDeletes = true;
    expect(await cleanupExportArtifactAttempts(now)).toEqual({ cleaned: 0, failed: 1 });
    expect(attempt()[1].status).toBe("cleanup_pending"); expect(attempt()[1].paths).toHaveLength(2);
    fixture.failDeletes = false;
    expect(await cleanupExportArtifactAttempts(now + 1)).toEqual({ cleaned: 1, failed: 0 });
    expect(fixture.objects.size).toBe(0);
  });
  it("cannot clear a successor lease or delete its separate bytes", async () => {
    const { now } = seedExpiredAttempt();
    const successorPath = "exports/user-a/job-a/00000000-0000-4000-8000-000000000002/export.json";
    fixture.documents.set("exportJobs/job-a", { ...job(), processingLeaseToken: "successor" });
    fixture.documents.set("privacyDeletionTombstones/user-a", { ...fence(), exportProcessingLeaseToken: "successor" });
    fixture.objects.set(successorPath, "successor-bytes");
    await cleanupExportArtifactAttempts(now);
    expect(job().status).toBe("processing"); expect(job().processingLeaseToken).toBe("successor");
    expect(fence().exportProcessingLeaseToken).toBe("successor");
    expect([...fixture.objects.entries()]).toEqual([[successorPath, "successor-bytes"]]);
  });
  it("blocks corrupted paths without deleting another account's object", async () => {
    const { now } = seedExpiredAttempt();
    fixture.documents.set(attempt()[0], { ...attempt()[1], paths: ["exports/user-b/job-a/export.json"] });
    await cleanupExportArtifactAttempts(now);
    expect(attempt()[1].status).toBe("cleanup_blocked"); expect(fixture.deletes).toEqual([]);
  });
  it("reclaims a cleanup worker after a transaction/audit outage", async () => {
    const { now } = seedExpiredAttempt(); fixture.failAuditTransaction = 2;
    expect(await cleanupExportArtifactAttempts(now)).toEqual({ cleaned: 0, failed: 1 });
    expect(attempt()[1].status).toBe("artifact_cleanup");
    fixture.failAuditTransaction = 0;
    expect(await cleanupExportArtifactAttempts(now + 16 * 60 * 1000)).toEqual({ cleaned: 1, failed: 0 });
    expect(attempt()[1].status).toBe("cleaned");
  });
  it("makes repeated completed cleanup idempotent", async () => {
    const { now } = seedExpiredAttempt();
    await cleanupExportArtifactAttempts(now);
    fixture.deletes = [];
    expect(await cleanupExportArtifactAttempts(now + 1)).toEqual({ cleaned: 0, failed: 0 });
    expect(fixture.deletes).toEqual([]);
  });
  it("does not recreate a removed attempt after account deletion", async () => {
    const { now } = seedExpiredAttempt();
    fixture.beforeTransaction = (phase) => { if (phase === 2) fixture.documents.delete(attempt()[0]); };
    await cleanupExportArtifactAttempts(now);
    expect([...fixture.documents.keys()].filter((path) => path.startsWith("exportArtifactAttempts/"))).toHaveLength(0);
  });
});

describe("export callable failure and concurrency behavior", () => {
  it("publishes artifacts and completion audit atomically with one attempt identity", async () => {
    const result = await run(adminRequest);
    expect(result.status).toBe("completed");
    expect(fixture.objects.size).toBe(2); expect(fixture.deletes).toEqual([]);
    expect(job().status).toBe("completed"); expect(job().complete).toBe(true);
    expect(attempt()[1].status).toBe("completed");
    const audit = fixture.documents.get(`auditLogs/${result.auditId}`)!;
    expect(audit.action).toBe("export_processed");
    expect(audit.metadata).not.toHaveProperty("exportPath");
    expect(fence()).not.toHaveProperty("exportProcessingLeaseToken");
  });
  it("rejects anonymous and ordinary-user processing before claiming or writing", async () => {
    await expect(run({ data: { jobId: "job-a" } })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(run({ auth: { uid: "user-a", token: {} }, data: { jobId: "job-a" } })).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.transactions).toBe(0); expect(fixture.objects.size).toBe(0);
  });
  it("rejects path-injected job identifiers before claiming", async () => {
    await expect(run({ ...adminRequest, data: { jobId: "job-a/other" } })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fixture.transactions).toBe(0);
  });
  it("rejects duplicate active work without changing the first lease", async () => {
    fixture.documents.set("exportJobs/job-a", { ...job(), status: "processing", processingLeaseExpiresAt: { toMillis: () => Date.now() + 60_000 }, processingLeaseToken: "first" });
    await expect(run(adminRequest)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(job().processingLeaseToken).toBe("first"); expect(fixture.objects.size).toBe(0);
  });
  it("preserves the successor job, request, fence and artifacts after a stale attempt fails", async () => {
    const successorPath = "exports/user-a/job-a/successor/export.json";
    fixture.beforePublication = () => {
      fixture.documents.set("exportJobs/job-a", { uid: "user-a", requestId: "request-a", status: "completed", complete: true, exportPackagePath: successorPath });
      fixture.documents.set("privacyRequests/request-a", { uid: "user-a", type: "export", status: "completed" });
      fixture.documents.set("privacyDeletionTombstones/user-a", { uid: "user-a", exportProcessingJobId: "job-a", exportProcessingLeaseToken: "successor", exportProcessingBy: "admin-a" });
      fixture.objects.set(successorPath, "successor-bytes");
    };
    await expect(run(adminRequest)).rejects.toMatchObject({ code: "internal" });
    expect(job().status).toBe("completed"); expect(job().exportPackagePath).toBe(successorPath);
    expect(fixture.documents.get("privacyRequests/request-a")?.status).toBe("completed");
    expect(fence().exportProcessingLeaseToken).toBe("successor");
    expect([...fixture.objects.entries()]).toEqual([[successorPath, "successor-bytes"]]);
    expect(fixture.deletes).not.toContain(successorPath);
  });
  it("blocks publication if account deletion fences the subject during collection", async () => {
    fixture.beforePublication = () => { fixture.documents.set("privacyDeletionTombstones/user-a", { ...fence(), active: true }); };
    await expect(run(adminRequest)).rejects.toMatchObject({ code: "internal" });
    expect(job().status).toBe("failed"); expect(fixture.objects.size).toBe(0); expect(fence().active).toBe(true);
  });
  it("records an audit outage as failure without publishing unaudited completion", async () => {
    fixture.failAudit = true;
    await expect(run(adminRequest)).rejects.toMatchObject({ code: "internal" });
    expect(job().status).toBe("failed"); expect(fixture.objects.size).toBe(0);
    const audit = [...fixture.documents.values()].find((row) => row.action === "export_processing_failed")!;
    expect(audit).toBeDefined(); expect(JSON.stringify(audit)).not.toContain("/sensitive/provider/key");
  });
  it("never removes published artifacts when a successful commit response is lost", async () => {
    fixture.losePublicationReply = true;
    await expect(run(adminRequest)).rejects.toMatchObject({ code: "unavailable" });
    expect(job().status).toBe("completed"); expect(fixture.objects.size).toBe(2); expect(fixture.deletes).toEqual([]);
    expect([...fixture.documents.values()].filter((row) => row.action === "export_processed")).toHaveLength(1);
  });
  it("retains cleanup ownership when Storage removal fails, without exposing raw paths", async () => {
    fixture.failSave = 2; fixture.failDeletes = true;
    const error = await run(adminRequest).catch((value) => value);
    expect(error.code).toBe("internal"); expect(error.details.artifactCleanupStatus).toBe("incomplete");
    expect(error.message).not.toContain("/private/path");
    expect(attempt()[1].status).toBe("cleanup_pending");
    expect(attempt()[1].paths).toHaveLength(2);
    expect(job().status).toBe("failed");
  });
  it("keeps the attempt ledger retryable when all audit writes fail", async () => {
    fixture.failAllAudits = true;
    const error = await run(adminRequest).catch((value) => value);
    expect(error.code).toBe("unavailable"); expect(error.message).not.toContain("/sensitive/provider/key");
    expect(attempt()[1].status).toBe("processing"); expect(job().status).toBe("processing");
  });
  it("preserves artifacts while publication status readback is unavailable", async () => {
    fixture.losePublicationReply = true; fixture.failAttemptRead = true;
    await expect(run(adminRequest)).rejects.toMatchObject({ code: "unavailable" });
    expect(job().status).toBe("completed"); expect(fixture.objects.size).toBe(2); expect(fixture.deletes).toEqual([]);
  });
  it("does not recreate removed subject ledgers after deletion races with failure cleanup", async () => {
    fixture.beforePublication = () => {
      fixture.documents.delete("exportJobs/job-a"); fixture.documents.delete("privacyRequests/request-a");
      fixture.documents.delete(attempt()[0]);
      fixture.documents.set("privacyDeletionTombstones/user-a", { uid: "user-a", active: true });
    };
    await expect(run(adminRequest)).rejects.toMatchObject({ code: "internal" });
    expect(fixture.documents.has("exportJobs/job-a")).toBe(false); expect(fixture.objects.size).toBe(0);
    expect([...fixture.documents.keys()].filter((path) => path.startsWith("exportArtifactAttempts/"))).toHaveLength(0);
  });
});

describe("export attempt deletion residual verification", () => {
  it("cannot report deletion complete while an export attempt ledger remains", async () => {
    fixture.documents.delete("exportJobs/job-a"); fixture.documents.delete("privacyRequests/request-a");
    fixture.documents.set("exportArtifactAttempts/stale", { uid: "user-a", status: "cleanup_pending" });
    const residuals = await collectDeletionCompletionResiduals("user-a");
    expect(residuals.firestoreTargets.exportArtifactAttempts).toEqual(["stale"]);
    expect(residuals.totalResidualTargets).toBe(1);
    fixture.documents.delete("exportArtifactAttempts/stale");
    expect((await collectDeletionCompletionResiduals("user-a")).totalResidualTargets).toBe(0);
  });
  it("separately counts account, export bytes, Auth and legal hold without including another user", async () => {
    fixture.documents.delete("exportJobs/job-a"); fixture.documents.delete("privacyRequests/request-a");
    fixture.documents.set("exportArtifactAttempts/other", { uid: "user-b" });
    fixture.documents.set("users/user-a", { uid: "user-a", legalHold: true });
    fixture.objects.set("exports/user-a/job-a/attempt/export.json", "private"); fixture.authExists = true;
    const residuals = await collectDeletionCompletionResiduals("user-a");
    expect(residuals.firestoreTargets.exportArtifactAttempts).toEqual([]);
    expect(residuals.totalResidualTargets).toBe(3); expect(residuals.legalHold).toBe(true); expect(residuals.authUserExists).toBe(true);
  });
});
