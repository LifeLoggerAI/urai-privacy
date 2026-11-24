import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { once } from "node:events";
import express from "express";

// Only provider edges are simulated. The registered callable, authorization,
// generation selection and control flow run unchanged.
const mocks = vi.hoisted(() => {
  const rows = new Map<string, Record<string, unknown>>();
  const read = (path: string) => ({ exists: rows.has(path), data: () => structuredClone(rows.get(path)) });
  const ref = (path: string) => ({
    path, id: path.split("/").at(-1), get: async () => read(path),
    set: async (row: Record<string, unknown>) => { rows.set(path, structuredClone(row)); }
  });
  const db = {
    collection: (name: string) => ({ doc: (id = "test-audit") => ref(name + "/" + id) }),
    runTransaction: (fn: (tx: { get: (ref: {path: string}) => unknown; create: (ref: {path: string}, data: Record<string, unknown>) => void }) => unknown) =>
      fn({ get: async ({ path }) => read(path), create: ({ path }, data) => { rows.set(path, structuredClone(data)); } })
  };
  const stream = vi.fn();
  const metadata = vi.fn();
  const verifyToken = vi.fn();
  const getUser = vi.fn();
  return { rows, db, stream, metadata, verifyToken, getUser };
});
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], getApp: () => ({options: {projectId: "demo-synthetic-export"}}) }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mocks.db, FieldValue: { serverTimestamp: () => "server-timestamp" }
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ createReadStream: mocks.stream, getMetadata: mocks.metadata }) }) })
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: mocks.verifyToken, getUser: mocks.getUser }) }));

import { getExportDownloadUrl, downloadExportPackage } from "../src/export-lifecycle-functions";
import { CONSENT_DECISION_POLICY_VERSION } from "../src/consent-decision";
const owner = "synthetic-owner";
const jobId = "synthetic-job";
const requestId = "synthetic-request";
const consentKey = "consentRecords/" + owner + "_data_export";
const jobKey = "exportJobs/" + jobId;
const requestKey = "privacyRequests/" + requestId;
const receipt = "a".repeat(64);
const bytes = Buffer.alloc(150000, 115);
const digest = createHash("sha256").update(bytes).digest("hex");
const metadata = { generation: "17", size: String(bytes.length), contentType: "application/json", metadata: { sha256: digest } };
const update = (key: string, values: Record<string, unknown>) =>
  mocks.rows.set(key, { ...mocks.rows.get(key), ...values });
function invoke(uid = owner, claims: Record<string, unknown> = {}) {
  mocks.verifyToken.mockResolvedValue({ uid, ...claims });
  return getExportDownloadUrl.run({ data: { jobId, file: "export" },
    auth: { uid, token: claims }, rawRequest: { headers: { authorization: "Bearer synthetic.test.token" }, get: () => "127.0.0.1:5001" }
  } as unknown as Parameters<typeof getExportDownloadUrl.run>[0]);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rows.clear();
  const expiry = new Date(Date.now() + 60_000).toISOString();
  const grant = { consentReceiptHash: receipt, exportConsentExpiresAt: expiry };
  mocks.rows.set(consentKey, { uid: owner, purpose: "data.export", consentTier: "C7",
    status: "granted", policyVersion: CONSENT_DECISION_POLICY_VERSION, receiptHash: receipt, expiresAt: expiry });
  mocks.rows.set(requestKey, { uid: owner, type: "export", status: "completed", ...grant });
  mocks.rows.set(jobKey, { uid: owner, requestId, status: "completed", complete: true,
    packageExpiresAt: Date.now() + 3600_000, exportPackagePath: "exports/" + owner + "/" + jobId + "/export.json",
    exportManifestPath: "exports/" + owner + "/" + jobId + "/manifest.json", exportSha256: digest,
    manifestSha256: "c".repeat(64), ...grant });
  mocks.metadata.mockResolvedValue([metadata]);
  mocks.stream.mockImplementation(() => Readable.from([bytes]));
  mocks.getUser.mockResolvedValue({ disabled: false, customClaims: {} });
});

describe("registered export download callable with controlled provider dependencies", () => {
  it("requests the exact generation with expiry capped by the current owner's grant", async () => {
    const answer = await invoke();
    const expires = Date.parse(String(mocks.rows.get(consentKey)?.expiresAt));
    expect(answer.downloadExpiresAt).toBe(expires);
    expect(answer).toMatchObject({ generation: "17", sha256: digest, byteLength: bytes.length, requiresAuthorization: true, uid: owner, requestId });
    expect(answer.url).toMatch(/^https:\/\/us-central1-demo-synthetic-export\.cloudfunctions\.net\/downloadExportPackage\?/);
    expect(mocks.rows.get("auditLogs/test-audit")).toMatchObject({targetUid:owner, requestId, metadata:{authorityHash:answer.authorityHash}});
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.verifyToken.mock.calls.every(call => call[1] === true)).toBe(true);
  });

  it.each([
    ["missing grant", () => mocks.rows.delete(consentKey)],
    ["revoked grant", () => update(consentKey, { status: "revoked" })],
    ["replaced receipt", () => update(consentKey, { receiptHash: "e".repeat(64) })],
    ["foreign consent subject", () => update(consentKey, { uid: "other" })],
    ["unbound historical package", () => update(jobKey, { consentReceiptHash: undefined })],
    ["foreign parent request", () => update(requestKey, { uid: "other" })],
    ["changed request grant expiry", () => update(requestKey, { exportConsentExpiresAt: "1970-01-01T00:00:01Z" })],
    ["current deletion fence", () => update("privacyDeletionTombstones/" + owner, { active: false })],
  ])("withholds a descriptor for %s", async (_name, change) => {
    (change as () => unknown)();
    await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.rows.has("auditLogs/test-audit")).toBe(false);
  });

  it("declines a package beyond the bounded digest-index capacity", async () => {
    mocks.metadata.mockResolvedValue([{ ...metadata, size: String(4 * 1024 * 1024 * 4096 + 1) }]);
    await expect(invoke()).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(mocks.rows.has("auditLogs/test-audit")).toBe(false);
  });

  it("denies an admin token after the current admin role is removed", async () => {
    await expect(invoke("synthetic-operator", { admin: true })).rejects.toMatchObject({ code: "permission-denied" });
    expect(mocks.rows.has("auditLogs/test-audit")).toBe(false);
  });

  it("denies a fresh descriptor if consent changes during metadata lookup", async () => {
    mocks.metadata.mockImplementationOnce(async () => {
      update(consentKey, { status: "revoked" });
      return [metadata];
    });
    await expect(invoke()).rejects.toMatchObject({code:"failed-precondition"});
    expect(mocks.rows.has("auditLogs/test-audit")).toBe(false);
  });

  it("withholds the descriptor if withdrawal occurs during the final metadata read", async () => {
    mocks.metadata.mockResolvedValueOnce([metadata]).mockImplementationOnce(async () => {
      update(consentKey, { status: "revoked" });
      return [metadata];
    });
    await expect(invoke()).rejects.toMatchObject({code:"failed-precondition"});
    expect(mocks.rows.has("auditLogs/test-audit")).toBe(true);
  });

  it.each([
    ["C7 withdrawal", () => update(consentKey, { status: "revoked" })],
    ["deletion marker", () => update("accountDeletionFences/" + owner, { active: false })],
    ["disabled owner", () => mocks.getUser.mockResolvedValue({disabled:true})],
    ["revoked token", () => mocks.verifyToken.mockRejectedValue(new Error("synthetic revoked token"))],
    ["new object generation", () => mocks.metadata.mockResolvedValue([{ ...metadata, generation:"18" }])]
  ])("stops the registered HTTP response after one authorized chunk on %s", async (_reason, revoke) => {
    const issued = await invoke();
    let emitted = 0;
    const app = express();
    app.get("/downloadExportPackage", (req, res) => {
      const write = res.write.bind(res);
      res.write = ((chunk: Buffer) => {
        const accepted = write(chunk);
        emitted += chunk.length;
        (revoke as () => void)();
        return accepted;
      }) as typeof res.write;
      return downloadExportPackage(req, res);
    });
    const server = app.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw Error("missing local server address");
      const url = new URL(issued.url);
      const result = await fetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`,
        { headers: { Authorization: "Bearer synthetic.test.token" } });
      expect(result.status).toBe(200);
      await expect(result.arrayBuffer()).rejects.toThrow();
      expect(emitted).toBe(64 * 1024);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
