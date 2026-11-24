import { beforeEach, describe, expect, it, vi } from "vitest";

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
    runTransaction: (fn: (tx: { get: (ref: {path: string}) => unknown }) => unknown) =>
      fn({ get: async ({ path }) => read(path) })
  };
  const signer = vi.fn();
  const metadata = vi.fn();
  const verifyToken = vi.fn();
  const getUser = vi.fn();
  return { rows, db, signer, metadata, verifyToken, getUser };
});
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], getApp: () => ({}) }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mocks.db, FieldValue: { serverTimestamp: () => "server-timestamp" }
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ getSignedUrl: mocks.signer, getMetadata: mocks.metadata }) }) })
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: mocks.verifyToken, getUser: mocks.getUser }) }));

import { getExportDownloadUrl } from "../src/export-lifecycle-functions";
import { CONSENT_DECISION_POLICY_VERSION } from "../src/consent-decision";
const owner = "synthetic-owner";
const jobId = "synthetic-job";
const requestId = "synthetic-request";
const consentKey = "consentRecords/" + owner + "_data_export";
const jobKey = "exportJobs/" + jobId;
const requestKey = "privacyRequests/" + requestId;
const receipt = "a".repeat(64);
const digest = "b".repeat(64);
const update = (key: string, values: Record<string, unknown>) =>
  mocks.rows.set(key, { ...mocks.rows.get(key), ...values });
function invoke(uid = owner, claims: Record<string, unknown> = {}) {
  mocks.verifyToken.mockResolvedValue({ uid });
  return getExportDownloadUrl.run({ data: { jobId, file: "export" },
    auth: { uid, token: claims }, rawRequest: { headers: { authorization: "Bearer synthetic.test.token" } }
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
  mocks.metadata.mockResolvedValue([{ generation: "17", metadata: { sha256: digest } }]);
  mocks.signer.mockResolvedValue(["https://example.invalid/synthetic-signer"]);
  mocks.getUser.mockResolvedValue({ disabled: false, customClaims: {} });
});

describe("registered export download callable with controlled provider dependencies", () => {
  it("requests the exact generation with expiry capped by the current owner's grant", async () => {
    const answer = await invoke();
    const expires = Date.parse(String(mocks.rows.get(consentKey)?.expiresAt));
    expect(answer.signedUrlExpiresAt).toBe(expires);
    expect(mocks.signer).toHaveBeenCalledTimes(1);
    expect(mocks.signer).toHaveBeenCalledWith({ action: "read", version: "v4", expires, queryParams: { generation: "17" } });
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
  ])("withholds a signing request for %s", async (_name, change) => {
    (change as () => unknown)();
    await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.signer).not.toHaveBeenCalled();
  });

  it("denies an admin token after the current admin role is removed", async () => {
    await expect(invoke("synthetic-operator", { admin: true })).rejects.toMatchObject({ code: "permission-denied" });
    expect(mocks.signer).not.toHaveBeenCalled();
  });

  it("denies a fresh signing request if consent changes during metadata lookup", async () => {
    mocks.metadata.mockImplementationOnce(async () => {
      update(consentKey, { status: "revoked" });
      return [{ generation: "17", metadata: { sha256: digest } }];
    });
    await expect(invoke()).rejects.toMatchObject({code:"failed-precondition"});
    expect(mocks.signer).not.toHaveBeenCalled();
  });

  it("withholds the result if consent changes while the provider is signing", async () => {
    mocks.signer.mockImplementationOnce(async () => {
      update(consentKey, { status: "revoked" });
      return ["https://example.invalid/withheld"];
    });
    await expect(invoke()).rejects.toMatchObject({code:"failed-precondition"});
    expect(mocks.signer).toHaveBeenCalledTimes(1);
  });
});
