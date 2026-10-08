import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_DECISION_POLICY_VERSION } from "../../functions/src/consent-decision";

const fixture = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  reads: [] as string[],
  writes: [] as string[],
  serial: 0,
  uid: "owner-a",
  signedClaims: {} as Record<string, unknown>,
  currentClaims: {} as Record<string, unknown>,
  revoked: false,
  disabled: false,
  creationTime: "2026-10-01T00:00:00.000Z",
  verificationChecks: [] as boolean[],
  afterRead: null as null | (() => void),
  afterCommit: null as null | (() => void)
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
        const stage = (target: { path: string }, value: Record<string, unknown>, options?: { merge?: boolean }) => {
          writes.push({ path: target.path, value, merge: options?.merge ?? false });
        };
        const result = await fn({
          get: async (target: { path: string }) => {
            fixture.reads.push(target.path);
            const value = fixture.records.get(target.path);
            fixture.afterRead?.();
            return { exists: value !== undefined, data: () => value };
          },
          set: stage,
          create: stage
        });
        for (const { path, value, merge } of writes) {
          const next: Record<string, unknown> = { ...(merge ? fixture.records.get(path) : {}), ...value };
          for (const [key, entry] of Object.entries(next)) if (entry === DELETE) delete next[key];
          fixture.records.set(path, next);
          fixture.writes.push(path);
        }
        fixture.afterCommit?.();
        return result;
      }
    })
  };
});
const authMock = vi.hoisted(() => ({ getAuth: () => ({
  verifyIdToken: async (_bearer: string, checkRevoked: boolean) => {
    fixture.verificationChecks.push(checkRevoked);
    if (!checkRevoked || fixture.revoked) throw new Error("synthetic revoked token");
    return { uid: fixture.uid, ...fixture.signedClaims };
  },
  getUser: async (uid: string) => ({ uid, disabled: fixture.disabled,
    customClaims: { ...fixture.currentClaims }, metadata: { creationTime: fixture.creationTime } })
}) }));
const httpsMock = vi.hoisted(() => ({
  onCall: (handler: unknown) => handler,
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } }
}));
vi.mock("firebase-admin/firestore", () => firestoreMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => firestoreMock);
vi.mock("firebase-admin/auth", () => authMock);
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/auth/index.js", () => authMock);
vi.mock("firebase-functions/v2/https", () => httpsMock);
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/https.js", () => httpsMock);

import { setCanonicalConsent, evaluateCanonicalConsent } from "../../functions/src/consent-api";
type SyntheticRequest = { auth?: { uid: string; token: Record<string, unknown> }; data: Record<string, unknown>; rawRequest?: { get: () => string } };
const set = setCanonicalConsent as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const evaluate = evaluateCanonicalConsent as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const request = (data: Record<string, unknown>): SyntheticRequest => ({
  auth: { uid: fixture.uid, token: { ...fixture.signedClaims } }, data,
  rawRequest: { get: () => "Bearer synthetic-current-actor" }
});
const grant = () => set(request({ purpose: "data.export", status: "granted" }));
const decision = (targetUid = "owner-a") => evaluate(request({
  purpose: "data.export", targetUid, correlationId: "synthetic-correlation"
}));
function admin() {
  fixture.uid = "admin-a";
  fixture.signedClaims = { admin: true };
  fixture.currentClaims = { admin: true };
}
function system() {
  fixture.uid = "system-a";
  fixture.signedClaims = { role: "system", consumerId: "urai-jobs" };
  fixture.currentClaims = { role: "system", consumerId: "urai-jobs" };
}

beforeEach(() => {
  fixture.records.clear(); fixture.reads = []; fixture.writes = []; fixture.serial = 0;
  fixture.uid = "owner-a"; fixture.signedClaims = {}; fixture.currentClaims = {};
  fixture.revoked = false; fixture.disabled = false;
  fixture.creationTime = "2026-10-01T00:00:00.000Z";
  fixture.verificationChecks = []; fixture.afterRead = null; fixture.afterCommit = null;
  fixture.records.set("privacyDeletionTombstones/owner-a", { uid: "owner-a", active: false });
  fixture.records.set("consentRecords/owner-a_data_export", {
    uid: "owner-a", purpose: "data.export", consentTier: "C7", status: "granted",
    policyVersion: CONSENT_DECISION_POLICY_VERSION, expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
});

describe("actual canonical consent handlers keep current actor authority", () => {
  it("preserves the owner grant and its atomic receipt/projection/event/audit writes", async () => {
    const result = await grant();
    expect(result.status).toBe("granted");
    expect(fixture.writes).toHaveLength(4);
    expect(fixture.verificationChecks.length).toBeGreaterThan(0);
    expect(fixture.verificationChecks.every(Boolean)).toBe(true);
  });
  it("evaluates current owner consent and records a user access event", async () => {
    const result = await decision();
    expect(result.allowed).toBe(true);
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.records.get(fixture.writes[0])?.actorRole).toBe("user");
  });
  it.each(["disabled", "revoked"])("rejects an initially %s actor without creating consent state", async (state) => {
    fixture[state as "disabled" | "revoked"] = true;
    await expect(grant()).rejects.toMatchObject({ code: "unauthenticated" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it.each(["disabled", "revoked", "recreated", "switched"])("blocks a grant when its actor becomes %s during the real fence read", async (state) => {
    fixture.afterRead = () => {
      if (state === "disabled") fixture.disabled = true;
      else if (state === "revoked") fixture.revoked = true;
      else if (state === "recreated") fixture.creationTime = "2026-10-08T00:00:00.000Z";
      else fixture.uid = "owner-b";
    };
    await expect(grant()).rejects.toMatchObject({ code: state === "switched" ? "permission-denied" : "unauthenticated" });
    expect(fixture.writes).toEqual([]);
  });
  it("withholds a grant response after commit when the actor is revoked", async () => {
    fixture.afterCommit = () => { fixture.revoked = true; };
    await expect(grant()).rejects.toMatchObject({ code: "unauthenticated" });
    // Auth and Firestore are not one atomic service; the authorized commit is retained.
    expect(fixture.writes).toHaveLength(4);
  });
  it("preserves a current administrator's cross-user decision", async () => {
    admin();
    expect((await decision()).allowed).toBe(true);
    expect(fixture.records.get(fixture.writes[0])?.actorRole).toBe("admin");
  });
  it("rejects a removed current administrator before reading another user's consent", async () => {
    admin(); fixture.currentClaims = {};
    await expect(decision()).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it("rejects a current-only administrator absent from the signed token", async () => {
    admin(); fixture.signedClaims = {};
    await expect(decision()).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it.each(["role-removed", "disabled", "revoked", "recreated"])("blocks another user's decision when the administrator becomes %s during the source read", async (state) => {
    admin();
    fixture.afterRead = () => {
      if (state === "role-removed") fixture.currentClaims = {};
      else if (state === "disabled") fixture.disabled = true;
      else if (state === "revoked") fixture.revoked = true;
      else fixture.creationTime = "2026-10-08T00:00:00.000Z";
    };
    await expect(decision()).rejects.toMatchObject({ code: state === "role-removed" ? "permission-denied" : "unauthenticated" });
    expect(fixture.writes).toEqual([]);
  });
  it("preserves a signed/current consumer-bound system decision", async () => {
    system();
    expect((await decision()).allowed).toBe(true);
    const event = fixture.records.get(fixture.writes[0]);
    expect(event?.actorRole).toBe("system"); expect(event?.consumerId).toBe("urai-jobs");
  });
  it("keeps mixed current admin claims at their signed system consumer authority", async () => {
    system(); fixture.signedClaims = { system: true, consumerId: "urai-jobs" };
    fixture.currentClaims = { system: true, role: "admin", consumerId: "urai-jobs" };
    expect((await decision()).allowed).toBe(true);
    const event = fixture.records.get(fixture.writes[0]);
    expect(event?.actorRole).toBe("system"); expect(event?.consumerId).toBe("urai-jobs");
  });
  it("keeps admin-only effects denied for signed system/current mixed admin claims", async () => {
    system(); fixture.signedClaims = { system: true, consumerId: "urai-jobs" };
    fixture.currentClaims = { system: true, role: "admin", consumerId: "urai-jobs" };
    const { createPrivacyActorGuard } = await import("../../functions/src/privacy-actor-guard");
    await expect(createPrivacyActorGuard(request({}), true)).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it.each(["removed", "rebound", "unsigned"])("rejects a system consumer that is %s before reading private consent", async (state) => {
    system();
    if (state === "removed") fixture.currentClaims = {};
    else if (state === "rebound") fixture.currentClaims = { role: "system", consumerId: "urai-studio" };
    else fixture.signedClaims = {};
    await expect(decision()).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it.each(["removed", "rebound"])("blocks the decision when its system consumer is %s during a source read", async (state) => {
    system(); fixture.afterRead = () => {
      fixture.currentClaims = state === "removed" ? {} : { role: "system", consumerId: "urai-studio" };
    };
    await expect(decision()).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.writes).toEqual([]);
  });
  it("withholds another user's decision after commit if the administrator loses authority", async () => {
    admin(); fixture.afterCommit = () => { fixture.currentClaims = {}; };
    await expect(decision()).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.writes).toHaveLength(1);
  });
  it("requires the signed Bearer transport before any grant", async () => {
    const input = request({ purpose: "data.export", status: "granted" });
    delete input.rawRequest;
    await expect(set(input)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
});
