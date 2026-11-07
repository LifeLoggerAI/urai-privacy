import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_DECISION_POLICY_VERSION } from "../../functions/src/consent-decision";

const fixture = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  signs: [] as Array<{ path: string; expires: number }>,
  audits: [] as Array<Record<string, unknown>>,
  beforeSign: null as null | (() => void),
  failAudit: false,
  transactions: 0,
  serial: 0,
  verifyFails: false,
  verificationUid: null as string | null,
  currentAdminAllowed: true,
  verificationChecks: [] as boolean[],
  afterTransaction: null as null | ((id: number) => void),
  delivered: [] as string[],
  chunks: [] as Buffer[],
  afterChunk: null as null | (() => void),
  closed: false
}));
const firestoreMock = vi.hoisted(() => {
  const ref = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
    get: async () => ({ exists: fixture.records.has(path), data: () => fixture.records.get(path) }),
    set: async (value: Record<string, unknown>) => {
      if (fixture.failAudit) throw new Error("synthetic audit outage");
      fixture.audits.push(value);
    },
    update: async (value: Record<string, unknown>) => fixture.records.set(path, { ...fixture.records.get(path), ...value })
  });
  return {
    FieldValue: { serverTimestamp: () => "synthetic-server-timestamp" },
    Timestamp: { fromMillis: (value: number) => ({ toMillis: () => value }) },
    getFirestore: () => ({
      collection: (name: string) => ({ doc: (id?: string) => ref(`${name}/${id ?? `audit-${++fixture.serial}`}`) }),
      runTransaction: async (fn: (tx: unknown) => unknown) => {
        const id = ++fixture.transactions;
        const writes: Array<{ path: string; value: Record<string, unknown> }> = [];
        const result = await fn({
          get: async (target: { path: string }) => ({ exists: fixture.records.has(target.path), data: () => fixture.records.get(target.path) }),
          create: (target: { path: string }, value: Record<string, unknown>) => {
            if (fixture.failAudit) throw new Error("synthetic audit outage");
            writes.push({ path: target.path, value });
          }
        });
        for (const write of writes) { fixture.records.set(write.path, write.value); fixture.audits.push(write.value); }
        fixture.afterTransaction?.(id);
        return result;
      }
    })
  };
});
const appMock = vi.hoisted(() => ({ getApps: () => [{}], getApp: () => ({ options: { projectId: "synthetic-project" } }), initializeApp: () => ({ options: { projectId: "synthetic-project" } }) }));
const storageMock = vi.hoisted(() => ({
  getStorage: () => ({ bucket: () => ({ file: (path: string) => ({
    exists: async () => { fixture.beforeSign?.(); return [true]; },
    createReadStream: () => { fixture.delivered.push(path); return {
      async *[Symbol.asyncIterator]() { yield Buffer.alloc(128 * 1024, "s"); }, destroy: () => { fixture.closed = true; }
    }; },
    getSignedUrl: async ({ expires }: { expires: number }) => {
      fixture.signs.push({ path, expires }); fixture.beforeSign?.(); return ["https://synthetic.invalid/export"];
    }
  }) }) })
}));
const httpsMock = vi.hoisted(() => ({
  onCall: (handler: unknown) => handler,
  onRequest: (_options: unknown, handler: unknown) => handler,
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } }
}));
const schedulerMock = vi.hoisted(() => ({ onSchedule: (_options: unknown, handler: unknown) => handler }));
vi.mock("firebase-admin/app", () => appMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/app/index.js", () => appMock);
vi.mock("firebase-admin/firestore", () => firestoreMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => firestoreMock);
vi.mock("firebase-admin/storage", () => storageMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/storage/index.js", () => storageMock);
vi.mock("firebase-functions/v2/https", () => httpsMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/https.js", () => httpsMock);
vi.mock("firebase-functions/v2/scheduler", () => schedulerMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/scheduler.js", () => schedulerMock);

const authMock = vi.hoisted(() => ({ getAuth: () => ({ verifyIdToken: async (token: string, checkRevoked: boolean) => {
  fixture.verificationChecks.push(checkRevoked);
  if (fixture.verifyFails || !checkRevoked) throw new Error("synthetic revoked token");
  return { uid: fixture.verificationUid ?? (token === "other-user" ? "user-b" : token === "current-admin" ? "synthetic-admin" : token === "admin-a" ? "admin-a" : "user-a"),
    admin: token === "current-admin" || token === "admin-a" };
}, getUser: async (uid: string) => ({ uid, disabled: false,
  metadata: { creationTime: "2026-10-01T00:00:00.000Z" },
  customClaims: (uid === "synthetic-admin" || uid === "admin-a") && fixture.currentAdminAllowed ? { admin: true } : {} }) }) }));
vi.mock("firebase-admin/auth", () => authMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/auth/index.js", () => authMock);
vi.mock("node:stream/promises", () => ({ pipeline: async (source: AsyncIterable<Buffer> & { destroy: () => void },
  guard: (source: AsyncIterable<Buffer>) => AsyncIterable<Buffer>, response: { destroyed: boolean }) => {
  try { for await (const chunk of guard(source)) { fixture.chunks.push(chunk); fixture.afterChunk?.(); } }
  catch (error) { source.destroy(); response.destroyed = true; throw error; }
} }));

import { getExportDownloadUrl, downloadExportPackage } from "../../functions/src/export-lifecycle-functions";
const callable = getExportDownloadUrl as unknown as (request: unknown) => Promise<Record<string, unknown>>;
const run = (request: { auth?: { uid: string; token?: Record<string, unknown> }; data: unknown }) => callable({ ...request,
  rawRequest: { get: () => request.auth?.uid ? `Bearer ${request.auth.uid === "user-a" ? "current-user" : request.auth.uid === "user-b" ? "other-user" : request.auth.uid === "admin-a" ? "admin-a" : "current-admin"}` : undefined } });
const ownerRequest = { auth: { uid: "user-a", token: {} }, data: { jobId: "job-a" } };
const receiptHash = "a".repeat(64);
const consentPath = "consentRecords/user-a_data_export";
const fencePath = "privacyDeletionTombstones/user-a";

beforeEach(() => {
  vi.restoreAllMocks();
  fixture.records.clear(); fixture.signs = []; fixture.audits = []; fixture.beforeSign = null;
  fixture.failAudit = false; fixture.transactions = 0; fixture.serial = 0; fixture.verifyFails = false; fixture.verificationUid = null; fixture.currentAdminAllowed = true; fixture.verificationChecks = []; fixture.afterTransaction = null; fixture.delivered = []; fixture.chunks = []; fixture.afterChunk = null; fixture.closed = false;
  const now = Date.now();
  const consentExpiresAt = now + 60_000;
  fixture.records.set(consentPath, {
    uid: "user-a", purpose: "data.export", consentTier: "C7", status: "granted",
    policyVersion: CONSENT_DECISION_POLICY_VERSION, receiptHash, expiresAt: new Date(consentExpiresAt).toISOString()
  });
  fixture.records.set(fencePath, {
    uid: "user-a", active: false, exportConsentStatus: "granted", exportConsentReceiptHash: receiptHash,
    exportConsentPolicyVersion: CONSENT_DECISION_POLICY_VERSION,
    exportConsentExpiresAt: { toMillis: () => consentExpiresAt }
  });
  fixture.records.set("exportJobs/job-a", {
    uid: "user-a", requestId: "request-a", status: "completed", complete: true,
    packageExpiresAt: { toMillis: () => now + 3_600_000 }, consentReceiptHash: receiptHash,
    exportConsentExpiresAt: { toMillis: () => consentExpiresAt },
    exportPackagePath: "exports/user-a/job-a/attempt/export.json", exportManifestPath: "exports/user-a/job-a/attempt/manifest.json"
  });
  fixture.records.set("privacyRequests/request-a", { uid: "user-a", type: "export", status: "completed" });
});

describe("actual export download callable authority", () => {
  it("caps the issued link at the current consent deadline without minting a bearer Storage URL", async () => {
    const result = await run(ownerRequest);
    expect(result.requiresAuthorization).toBe(true);
    expect(new URL(String(result.url)).hostname).toBe("us-central1-synthetic-project.cloudfunctions.net");
    expect(fixture.signs).toEqual([]);
    expect(result.downloadExpiresAt).toBe(Date.parse(String(fixture.records.get(consentPath)?.expiresAt)));
    expect(fixture.transactions).toBeGreaterThanOrEqual(2);
    expect(fixture.audits).toHaveLength(1);
  });
  it("rejects anonymous and other-user downloads without signing", async () => {
    await expect(run({ data: ownerRequest.data })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(run({ ...ownerRequest, auth: { uid: "user-b", token: {} } })).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.signs).toEqual([]);
  });
  it.each(["missing", "revoked", "expired", "replaced"])("denies %s current consent for owner and admin", async (state) => {
    if (state === "missing") fixture.records.delete(consentPath);
    else fixture.records.set(consentPath, { ...fixture.records.get(consentPath),
      ...(state === "revoked" ? { status: "revoked" } : state === "expired"
        ? { expiresAt: new Date(Date.now() - 1).toISOString() } : { receiptHash: "b".repeat(64) }) });
    await expect(run(ownerRequest)).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(run({ ...ownerRequest, auth: { uid: "admin-a", token: { admin: true } } })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fixture.signs).toEqual([]);
  });
  it("denies a deletion-fenced subject before signing", async () => {
    fixture.records.set(fencePath, { ...fixture.records.get(fencePath), active: true });
    await expect(run(ownerRequest)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fixture.signs).toEqual([]);
  });
  it("denies historical completed jobs without current receipt binding", async () => {
    const job = fixture.records.get("exportJobs/job-a")!;
    delete job.consentReceiptHash;
    await expect(run(ownerRequest)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fixture.signs).toEqual([]);
  });
  it.each(["consent", "deletion", "replacement"])("withholds a link when %s authority changes while checking Storage", async (state) => {
    fixture.beforeSign = () => {
      if (state === "consent") fixture.records.set(consentPath, { ...fixture.records.get(consentPath), status: "revoked" });
      else if (state === "deletion") fixture.records.set(fencePath, { ...fixture.records.get(fencePath), active: true });
      else fixture.records.set("exportJobs/job-a", { ...fixture.records.get("exportJobs/job-a"), exportPackagePath: "exports/user-a/job-a/successor/export.json" });
    };
    await expect(run(ownerRequest)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fixture.audits).toEqual([]);
  });
  it("withholds a link when its authorization audit cannot commit", async () => {
    fixture.failAudit = true;
    await expect(run(ownerRequest)).rejects.toThrow("synthetic audit outage");
    expect(fixture.audits).toEqual([]);
  });
  it("rejects a path-injected job ID before reading or signing", async () => {
    await expect(run({ ...ownerRequest, data: { jobId: "job-a/other" } })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fixture.transactions).toBe(0); expect(fixture.signs).toEqual([]);
  });
});


const deliver = downloadExportPackage as unknown as (request: unknown, response: unknown) => Promise<void>;
async function requestDownload(url: string, token: string | null = "current-user") {
  const state = { status: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const response = {
    headersSent: false, destroyed: false, writableFinished: false,
    set: (value: Record<string, string> | string, entry?: string) => {
      if (typeof value === "string") state.headers[value] = entry!; else Object.assign(state.headers, value); return response;
    },
    status: (value: number) => { state.status = value; return response; },
    json: (value: unknown) => { state.body = value; return response; }, once: () => response
  };
  await deliver({ method: "GET", query: Object.fromEntries(new URL(url).searchParams),
    get: () => token ? `Bearer ${token}` : undefined }, response);
  return state;
}

describe("actual authenticated export delivery endpoint", () => {
  it("delivers a current owner's export without a signed Storage URL", async () => {
    const issued = await run(ownerRequest);
    const reply = await requestDownload(String(issued.url));
    expect(reply.status).toBe(200); expect(fixture.delivered).toHaveLength(1);
    expect(fixture.signs).toEqual([]); expect(fixture.audits).toHaveLength(2);
    expect(reply.headers["Cache-Control"]).toBe("private, no-store");
  });
  it.each(["revoked", "missing", "replacement", "deletion"])("denies an already-issued descriptor after %s", async (reason) => {
    const issued = await run(ownerRequest);
    if (reason === "missing") fixture.records.delete(consentPath);
    else if (reason === "deletion") fixture.records.set(fencePath, { ...fixture.records.get(fencePath), active: true });
    else fixture.records.set(consentPath, { ...fixture.records.get(consentPath),
      ...(reason === "revoked" ? { status: "revoked" } : { receiptHash: "b".repeat(64) }) });
    const reply = await requestDownload(String(issued.url));
    expect(reply.status).toBe(409); expect(fixture.delivered).toEqual([]);
  });
  it("rejects expired descriptors, anonymous callers, cross-user tokens and revoked sessions", async () => {
    const issued = await run(ownerRequest);
    const expired = new URL(String(issued.url)); expired.searchParams.set("expiresAt", String(Date.now() - 1));
    expect((await requestDownload(expired.toString())).status).toBe(409);
    expect((await requestDownload(String(issued.url), null)).status).toBe(401);
    expect((await requestDownload(String(issued.url), "other-user")).status).toBe(403);
    fixture.verifyFails = true;
    expect((await requestDownload(String(issued.url))).status).toBe(401);
    expect(fixture.delivered).toEqual([]);
  });
  it("cannot stream private bytes if the delivery authorization audit fails", async () => {
    const issued = await run(ownerRequest); fixture.failAudit = true;
    const reply = await requestDownload(String(issued.url));
    expect(reply.status).toBe(500); expect(fixture.delivered).toEqual([]);
  });
});


describe("live export streaming authority", () => {
  it.each(["revocation", "deletion", "receipt", "session", "expiry"])("stops before the next 64KiB after %s", async (reason) => {
    const issued = await run(ownerRequest);
    fixture.afterChunk = () => {
      if (reason === "revocation") fixture.records.get(consentPath)!.status = "revoked";
      else if (reason === "deletion") fixture.records.get(fencePath)!.active = true;
      else if (reason === "receipt") fixture.records.get(consentPath)!.receiptHash = "b".repeat(64);
      else if (reason === "session") fixture.verifyFails = true;
      else vi.spyOn(Date, "now").mockReturnValue(Number(issued.downloadExpiresAt) + 1);
    };
    await requestDownload(String(issued.url));
    expect(fixture.chunks).toHaveLength(1);
    expect(fixture.chunks[0].length).toBe(64 * 1024);
    expect(fixture.closed).toBe(true);
  });
});


const authenticationDrifts = ["revocation", "owner change", "administrative permission withdrawal"];

describe("post-await canonical export authentication", () => {
  it.each(["initial authority", "object lookup", "audit"].flatMap(phase => authenticationDrifts.map(drift => [phase, drift])))("blocks %s delivery await after %s invalidation", async (phase, drift) => {
      const issued = await run(ownerRequest);
      const start = fixture.transactions;
      const invalidate = () => {
        if (drift === "revocation") fixture.verifyFails = true;
        else if (drift === "owner change") fixture.verificationUid = "synthetic-other-owner";
        else fixture.currentAdminAllowed = false;
      };
      fixture.afterTransaction = id => { if (id === start + (phase === "audit" ? 2 : 1) && phase !== "object lookup") invalidate(); };
      fixture.beforeSign = phase === "object lookup" ? invalidate : null;
      const reply = await requestDownload(String(issued.url), drift === "administrative permission withdrawal" ? "current-admin" : "current-user");
      expect(reply.status).toBe(drift === "revocation" ? 401 : 403);
      expect(fixture.delivered).toEqual([]); expect(fixture.chunks).toEqual([]);
      expect(fixture.verificationChecks.every(check => check === true)).toBe(true);
    });
  it.each([1, 2].flatMap(chunk => authenticationDrifts.map(drift => [chunk, drift] as const)))("does not yield chunk%s after %s during its authority await", async (chunk, drift) => {
      const issued = await run(ownerRequest);
      const start = fixture.transactions;
      fixture.afterTransaction = id => {
        if (id !== start + 2 + chunk) return;
        if (drift === "revocation") fixture.verifyFails = true;
        else if (drift === "owner change") fixture.verificationUid = "synthetic-other-owner";
        else fixture.currentAdminAllowed = false;
      };
      await requestDownload(String(issued.url), drift === "administrative permission withdrawal" ? "current-admin" : "current-user");
      expect(fixture.chunks).toHaveLength(chunk - 1);
      expect(fixture.chunks.reduce((sum, bytes) => sum + bytes.length, 0)).toBe((chunk - 1) * 64 * 1024);
      expect(fixture.closed).toBe(true);
      expect(fixture.verificationChecks.every(check => check === true)).toBe(true);
    });
});
