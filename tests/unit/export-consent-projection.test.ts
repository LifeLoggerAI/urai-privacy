import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  failAudit: false,
  reads: [] as string[],
  serial: 0
}));
const firestoreMock = vi.hoisted(() => {
  const DELETE = { kind: "delete" };
  return {
    FieldValue: { serverTimestamp: () => "synthetic-server-timestamp", delete: () => DELETE },
    Timestamp: { fromMillis: (millis: number) => ({ toMillis: () => millis }) },
    getFirestore: () => ({
      collection: (name: string) => ({ doc: (id?: string) => ({ path: `${name}/${id ?? `synthetic-${++fixture.serial}`}` }) }),
      runTransaction: async (fn: (transaction: unknown) => unknown) => {
        const writes: Array<{ path: string; value: Record<string, unknown>; merge: boolean }> = [];
        const result = await fn({
          get: async (target: { path: string }) => {
            fixture.reads.push(target.path);
            return { exists: fixture.records.has(target.path), data: () => fixture.records.get(target.path) };
          },
          set: (target: { path: string }, value: Record<string, unknown>, options?: { merge?: boolean }) => {
            if (fixture.failAudit && target.path.startsWith("auditLogs/")) throw new Error("synthetic audit outage");
            writes.push({ path: target.path, value, merge: options?.merge ?? false });
          }
        });
        for (const { path, value, merge } of writes) {
          const next: Record<string, unknown> = { ...(merge ? fixture.records.get(path) : {}), ...value };
          for (const [key, entry] of Object.entries(next)) if (entry === DELETE) delete next[key];
          fixture.records.set(path, next);
        }
        return result;
      }
    })
  };
});
const httpsMock = vi.hoisted(() => ({
  onCall: (handler: unknown) => handler,
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } }
}));
const authMock = vi.hoisted(() => ({ getAuth: () => ({
  verifyIdToken: async (_token: string, checkRevoked: boolean) => {
    if (!checkRevoked) throw new Error("Current token revocation check is required.");
    return { uid: "user-a" };
  },
  getUser: async (uid: string) => ({ uid, disabled: false, customClaims: {},
    metadata: { creationTime: "2026-10-01T00:00:00.000Z" } })
}) }));
vi.mock("firebase-admin/firestore", () => firestoreMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => firestoreMock);
vi.mock("firebase-functions/v2/https", () => httpsMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/https.js", () => httpsMock);
vi.mock("firebase-admin/auth", () => authMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/auth/index.js", () => authMock);

import { setCanonicalConsent } from "../../functions/src/consent-api";
const run = setCanonicalConsent as unknown as (request: { auth?: { uid: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
const fencePath = "privacyDeletionTombstones/user-a";
const request = (purpose: string, status: string) => ({ auth: { uid: "user-a" }, data: { purpose, status },
  rawRequest: { get: () => "Bearer synthetic-owner-token" } });

beforeEach(() => {
  fixture.records.clear(); fixture.reads = []; fixture.serial = 0; fixture.failAudit = false;
  fixture.records.set(fencePath, { uid: "user-a", active: false, retainedDeletionEvidence: "synthetic-existing" });
});

describe("actual canonical export consent projection", () => {
  it("commits the exact receipt and finite deadline to the subject fence with consent, event and audit", async () => {
    const result = await run(request("data.export", "granted"));
    const record = fixture.records.get("consentRecords/user-a_data_export")!;
    const fence = fixture.records.get(fencePath)!;
    expect(fence.exportConsentReceiptHash).toBe(result.receiptHash);
    expect(fence.exportConsentReceiptHash).toBe(record.receiptHash);
    expect(fence.exportConsentStatus).toBe("granted");
    expect((fence.exportConsentExpiresAt as { toMillis: () => number }).toMillis()).toBe(Date.parse(String(record.expiresAt)));
    expect(fence.retainedDeletionEvidence).toBe("synthetic-existing");
    expect([...fixture.records.keys()].filter((path) => path.startsWith("consentEvents/"))).toHaveLength(1);
    expect([...fixture.records.keys()].filter((path) => path.startsWith("auditLogs/"))).toHaveLength(1);
  });
  it.each(["revoked", "denied"])("removes the old download deadline atomically when the grant becomes %s", async (status) => {
    const prior = await run(request("data.export", "granted"));
    const result = await run(request("data.export", status));
    const fence = fixture.records.get(fencePath)!;
    expect(fence.exportConsentStatus).toBe(status);
    expect(fence.exportConsentReceiptHash).toBe(result.receiptHash);
    expect(result.receiptHash).not.toBe(prior.receiptHash);
    expect(fence).not.toHaveProperty("exportConsentExpiresAt");
  });
  it("cannot leave a download grant committed when the audit fails", async () => {
    fixture.failAudit = true;
    await expect(run(request("data.export", "granted"))).rejects.toThrow("synthetic audit outage");
    expect(fixture.records.size).toBe(1);
    expect(fixture.records.get(fencePath)).not.toHaveProperty("exportConsentStatus");
  });
  it("blocks consent updates behind account deletion without replacing the retained fence", async () => {
    fixture.records.set(fencePath, { uid: "user-a", active: true });
    await expect(run(request("data.export", "granted"))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fixture.records.size).toBe(1); expect(fixture.records.get(fencePath)?.active).toBe(true);
  });
  it("does not project unrelated purposes into export authority", async () => {
    await run(request("memory.storage", "granted"));
    expect(fixture.records.get(fencePath)).not.toHaveProperty("exportConsentStatus");
  });
  it.each(["constructor", "toString", "__proto__"])("rejects inherited purpose %s before opening a transaction", async (purpose) => {
    await expect(run(request(purpose, "granted"))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fixture.reads).toEqual([]); expect(fixture.records.size).toBe(1);
  });
});

