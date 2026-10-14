import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalConsentFixture } from "../fixtures/canonical-consent";
import { evaluateConsentDecision } from "../../functions/src/consent-decision";
const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  creates: [] as Array<{ path: string; value: Record<string, unknown> }>
}));
const firestoreMock = vi.hoisted(() => ({
  FieldValue: { serverTimestamp: () => "synthetic-server-timestamp" },
  getFirestore: () => ({
    collection: (collection: string) => ({ doc: (id: string) => ({ path: collection + "/" + id }) }),
    runTransaction: async (fn: (tx: unknown) => unknown) => fn({
      get: async (ref: { path: string }) => ({ exists: state.records.has(ref.path) }),
      create: (ref: { path: string }, value: Record<string, unknown>) => {
        state.creates.push({ path: ref.path, value }); state.records.set(ref.path, value);
      }
    })
  })
}));
vi.mock("firebase-admin/firestore", () => firestoreMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => firestoreMock);
const triggerMock = vi.hoisted(() => ({
  onDocumentWritten: (_path: string, handler: unknown) => handler
}));
vi.mock("firebase-functions/v2/firestore", () => triggerMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/firestore.js", () => triggerMock);
const httpsMock = vi.hoisted(() => ({
  onCall: (handler: unknown) => handler,
  HttpsError: class extends Error {}
}));
vi.mock("firebase-functions/v2/https", () => httpsMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/https.js", () => httpsMock);
import { publishConsentRevocation } from "../../functions/src/consent-revocation";
async function invoke(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const snapshot = (data: Record<string, unknown> | null) => ({ exists: data !== null, data: () => data });
  return (publishConsentRevocation as unknown as (event: unknown) => Promise<void>)({
    params: { recordId: "consent-a" }, data: { before: snapshot(before), after: snapshot(after) }
  });
}
beforeEach(() => { state.records.clear(); state.creates.length = 0; });
describe("loaded revocation publisher and canonical rules fixture", () => {
  it("uses the canonical registry tier, policy and finite valid grant", () => {
    expect(evaluateConsentDecision({
      purpose: "ai.personalization", record: canonicalConsentFixture(),
      now: new Date("2026-10-07T00:00:00.000Z")
    }).allowed).toBe(true);
  });
  it("publishes cleanup deletion from a complete grant with bound evidence", async () => {
    const grant = canonicalConsentFixture();
    await invoke(grant, null);
    expect(state.creates).toHaveLength(1);
    expect(state.creates[0].value).toMatchObject({
      uid: grant.uid, purpose: grant.purpose, consentTier: "C6", policyVersion: "1.0.0",
      sourceReceiptHash: grant.receiptHash, consentRecordId: "consent-a",
      schemaVersion: "consent.revoked.v1", status: "pending", attempts: 0
    });
    expect(state.creates[0].path).toMatch(/^consentRevocationOutbox\/[0-9a-f]{64}$/);
  });
  it("makes a repeated cleanup event idempotent", async () => {
    await invoke(canonicalConsentFixture(), null);
    await invoke(canonicalConsentFixture(), null);
    expect(state.creates).toHaveLength(1);
  });
  it("still rejects the old incomplete grant rather than weakening validation", async () => {
    await expect(invoke({ uid: "user-a", status: "granted", purpose: "ai.personalization" }, null))
      .rejects.toThrow("invalid canonical consent record");
    expect(state.creates).toHaveLength(0);
  });
  it("does not revoke when a grant is created", async () => {
    await invoke(null, canonicalConsentFixture());
    expect(state.creates).toHaveLength(0);
  });
  it("does not republish deletion of an already revoked receipt", async () => {
    await invoke({ ...canonicalConsentFixture(), status: "revoked" }, null);
    expect(state.creates).toHaveLength(0);
  });
  it("publishes a replacement revocation receipt and suppresses its replay", async () => {
    const grant = canonicalConsentFixture();
    const revoked = { ...grant, status: "revoked", receiptHash: "b".repeat(64) };
    await invoke(grant, revoked);
    expect(state.creates[0].value.sourceReceiptHash).toBe(revoked.receiptHash);
    await invoke(revoked, { ...revoked });
    expect(state.creates).toHaveLength(1);
  });
});
