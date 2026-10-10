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
  afterCommit: null as null | (() => void),
  rejectWritePrefix: null as null | string
}));
const firestoreMock = vi.hoisted(() => {
  const DELETE = { kind: "delete" };
  type SyntheticReference = { path: string; id: string; collection: (name: string) => { doc: (id?: string) => SyntheticReference } };
  const reference: (path: string) => SyntheticReference = (path) => ({
    path, id: path.split("/").at(-1)!, collection: (name: string) => ({ doc: (id?: string) => reference(`${path}/${name}/${id ?? `synthetic-${++fixture.serial}`}`) })
  });
  type SyntheticCollection = {
    doc: (id?: string) => SyntheticReference;
    where: (...args: unknown[]) => SyntheticCollection;
    limit: (count: number) => SyntheticCollection;
    get: () => Promise<{ size: number; docs: unknown[] }>;
  };
  const collection = (name: string): SyntheticCollection => {
    const value: SyntheticCollection = {
      doc: (id?: string) => reference(`${name}/${id ?? `synthetic-${++fixture.serial}`}`),
      where: () => value, limit: () => value,
      get: async () => { fixture.reads.push(`query/${name}`); fixture.afterRead?.(); return { size: 0, docs: [] }; }
    };
    return value;
  };
  return {
    FieldValue: { serverTimestamp: () => "synthetic-server-timestamp", delete: () => DELETE },
    Timestamp: { fromMillis: (millis: number) => ({ toMillis: () => millis }) },
    getFirestore: () => ({
      collection,
      runTransaction: async (fn: (transaction: unknown) => unknown) => {
        const writes: Array<{ path: string; value: Record<string, unknown>; merge: boolean }> = [];
        const stage = (target: { path: string }, value: Record<string, unknown>, options?: { merge?: boolean }) => {
          if (fixture.rejectWritePrefix && target.path.startsWith(fixture.rejectWritePrefix)) throw new Error("Synthetic audit write failure.");
          if (Object.values(value).some((entry) => entry === undefined)) throw new Error("Synthetic Firestore rejects undefined fields.");
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
          create: stage,
          update: (target: { path: string }, value: Record<string, unknown>) => stage(target, value, { merge: true })
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
vi.mock("firebase-functions/v2/firestore", () => ({ onDocumentWritten: (_path: string, handler: unknown) => handler }));
vi.mock("../../functions/node_modules/firebase-functions/lib/v2/providers/firestore.js", () => ({ onDocumentWritten: (_path: string, handler: unknown) => handler }));
vi.mock("firebase-admin/app", () => ({ initializeApp: () => ({}) }));
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/app/index.js", () => ({ initializeApp: () => ({}) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({}) }) }));
vi.mock("../../functions/node_modules/firebase-admin/lib/esm/storage/index.js", () => ({ getStorage: () => ({ bucket: () => ({}) }) }));

import { setCanonicalConsent, evaluateCanonicalConsent } from "../../functions/src/consent-api";
import { acknowledgeConsentRevocation } from "../../functions/src/consent-revocation";
import { createExportRequest, createDeletionRequest, writeAuditLog, recordAdminAction, getPrivacyHealthReport } from "../../functions/src/index";
type SyntheticRequest = { auth?: { uid: string; token: Record<string, unknown> }; data: Record<string, unknown>; rawRequest?: { get: () => string } };
const set = setCanonicalConsent as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const evaluate = evaluateCanonicalConsent as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const acknowledge = acknowledgeConsentRevocation as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const createExport = createExportRequest as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const createDeletion = createDeletionRequest as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const manualAudit = writeAuditLog as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const adminAction = recordAdminAction as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const health = getPrivacyHealthReport as unknown as (request: SyntheticRequest) => Promise<Record<string, unknown>>;
const eventId = "a".repeat(64);
const acknowledgementPath = `consentRevocationOutbox/${eventId}/acknowledgements/urai-jobs`;
const ackData = () => ({ eventId, consumerId: "urai-jobs", status: "applied", correlationId: "synthetic-ack-correlation", detailHash: "b".repeat(64) });
const ack = () => acknowledge(request(ackData()));
const request = (data: Record<string, unknown>): SyntheticRequest => ({
  auth: { uid: fixture.uid, token: { ...fixture.signedClaims } }, data,
  rawRequest: { get: () => "Bearer synthetic-current-actor" }
});

describe("actual exported request and administrator entry handlers keep current authority", () => {
  const ownerOperations = [
    ["export", () => createExport(request({}))],
    ["deletion", () => createDeletion(request({ reason: "Synthetic deletion request" }))]
  ] as const;
  const adminOperations = [
    ["audit", () => manualAudit(request({ action: "synthetic_review" }))],
    ["action", () => adminAction(request({ action: "synthetic_review", notes: "Synthetic note" }))],
    ["health", () => health(request({}))]
  ] as const;

  it.each(ownerOperations)("creates the current owner's %s request and its atomic audit", async (_name, operation) => {
    const reply = await operation();
    expect(reply.status).toBe("pending");
    expect(fixture.records.get(`auditLogs/${reply.auditId}`)).toMatchObject({ actorUid: "owner-a", actorRole: "user", requestId: reply.requestId });
    expect(fixture.writes.length).toBe(_name === "export" ? 3 : 2);
    expect(fixture.verificationChecks.length).toBeGreaterThan(0);
  });
  it.each(adminOperations)("preserves the current signed administrator's %s operation", async (name, operation) => {
    admin(); const reply = await operation();
    if (name === "health") expect(reply).toMatchObject({ verdict: "evidence_incomplete", certification: "not_certified" });
    else expect(fixture.records.get(`auditLogs/${reply.auditId}`)).toMatchObject({ actorUid: "admin-a", actorRole: "admin" });
    expect(fixture.verificationChecks.length).toBeGreaterThan(0);
  });
  it.each([...ownerOperations, ...adminOperations])("requires the original Bearer authentication for the %s entry handler", async (name) => {
    admin(); const withoutBearer = { ...request({ action: "synthetic_review" }), rawRequest: undefined };
    const operation = name === "export" ? createExport : name === "deletion" ? createDeletion
      : name === "audit" ? manualAudit : name === "action" ? adminAction : health;
    await expect(operation(withoutBearer)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it.each([...ownerOperations, adminOperations[1]])("aborts the %s record together with a failed audit write", async (_name, operation) => {
    admin(); fixture.rejectWritePrefix = "auditLogs/";
    await expect(operation()).rejects.toThrow("Synthetic audit write failure.");
    expect(fixture.writes).toEqual([]);
  });
  for (const [name, operation] of ownerOperations) {
    it.each(["disabled", "revoked"])("rejects an initially %s owner before its " + name + " request", async (state) => {
      fixture[state as "disabled" | "revoked"] = true;
      await expect(operation()).rejects.toMatchObject({ code: "unauthenticated" });
      expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
    });
    it.each(["disabled", "revoked", "recreated", "switched"])("blocks a " + name + " request when its owner becomes %s during the fence read", async (state) => {
      fixture.afterRead = () => {
        if (state === "disabled") fixture.disabled = true;
        else if (state === "revoked") fixture.revoked = true;
        else if (state === "recreated") fixture.creationTime = "2026-10-08T00:00:00.000Z";
        else fixture.uid = "owner-b";
      };
      await expect(operation()).rejects.toMatchObject({ code: state === "switched" ? "permission-denied" : "unauthenticated" });
      expect(fixture.writes).toEqual([]);
    });
    it("withholds " + name + " request success after an authorized commit when the owner is disabled", async () => {
      fixture.afterCommit = () => { fixture.disabled = true; };
      await expect(operation()).rejects.toMatchObject({ code: "unauthenticated" });
      expect(fixture.writes).toHaveLength(name === "export" ? 3 : 2);
    });
  }
  for (const [name, operation] of adminOperations) {
    it.each(["removed", "unsigned", "disabled", "revoked"])("rejects a %s administrator before the " + name + " operation", async (state) => {
      admin();
      if (state === "removed") fixture.currentClaims = {};
      else if (state === "unsigned") fixture.signedClaims = {};
      else fixture[state as "disabled" | "revoked"] = true;
      await expect(operation()).rejects.toMatchObject({ code: ["disabled", "revoked"].includes(state) ? "unauthenticated" : "permission-denied" });
      expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
    });
  }
  it.each(["removed", "disabled", "revoked", "recreated", "switched"])("withholds health results when its administrator becomes %s during a query", async (state) => {
    admin(); fixture.afterRead = () => {
      if (state === "removed") fixture.currentClaims = {};
      else if (state === "disabled") fixture.disabled = true;
      else if (state === "revoked") fixture.revoked = true;
      else if (state === "recreated") fixture.creationTime = "2026-10-08T00:00:00.000Z";
      else fixture.uid = "admin-b";
    };
    await expect(health(request({}))).rejects.toMatchObject({ code: ["removed", "switched"].includes(state) ? "permission-denied" : "unauthenticated" });
    expect(fixture.writes).toEqual([]);
  });
  it.each(adminOperations.slice(0, 2))("withholds %s success after an authorized transaction when administrator authority is removed", async (name, operation) => {
    admin(); fixture.afterCommit = () => { fixture.currentClaims = {}; };
    await expect(operation()).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.writes).toHaveLength(name === "audit" ? 1 : 2);
  });
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
  fixture.verificationChecks = []; fixture.afterRead = null; fixture.afterCommit = null; fixture.rejectWritePrefix = null;
  fixture.records.set("privacyDeletionTombstones/owner-a", { uid: "owner-a", active: false });
  fixture.records.set("consentRecords/owner-a_data_export", {
    uid: "owner-a", purpose: "data.export", consentTier: "C7", status: "granted",
    policyVersion: CONSENT_DECISION_POLICY_VERSION, expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
  fixture.records.set(`consentRevocationOutbox/${eventId}`, { eventId, uid: "owner-a", schemaVersion: "consent.revoked.v1" });
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

describe("actual revocation acknowledgements retain current consumer authority", () => {
  it("creates one bound acknowledgement, outbox update and audit receipt for the current signed consumer", async () => {
    system();
    expect(await ack()).toMatchObject({ eventId, consumerId: "urai-jobs", status: "applied", idempotent: false });
    expect(fixture.records.get(acknowledgementPath)).toMatchObject({ consumerId: "urai-jobs", actorUid: "system-a", actorRole: "system" });
    expect(fixture.writes).toHaveLength(3);
    expect(fixture.verificationChecks.length).toBeGreaterThan(0);
    expect(fixture.verificationChecks.every(Boolean)).toBe(true);
  });
  it("returns an identical current-consumer replay without another receipt write", async () => {
    system(); await ack(); fixture.writes = [];
    expect(await ack()).toMatchObject({ idempotent: true, auditId: null });
    expect(fixture.writes).toEqual([]);
  });
  it("rejects a different immutable acknowledgement payload", async () => {
    system(); await ack(); fixture.writes = [];
    await expect(acknowledge(request({ ...ackData(), detailHash: "c".repeat(64) }))).rejects.toMatchObject({ code: "already-exists" });
    expect(fixture.writes).toEqual([]);
  });
  it.each(["removed", "rebound", "unsigned"])("rejects a %s consumer before reading the outbox", async (state) => {
    system();
    if (state === "removed") fixture.currentClaims = {};
    else if (state === "rebound") fixture.currentClaims = { role: "system", consumerId: "urai-studio" };
    else fixture.signedClaims = {};
    await expect(ack()).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it.each(["disabled", "revoked"])("rejects an initially %s consumer before reading the outbox", async (state) => {
    system(); fixture[state as "disabled" | "revoked"] = true;
    await expect(ack()).rejects.toMatchObject({ code: "unauthenticated" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
  it.each(["removed", "rebound", "disabled", "revoked", "recreated", "switched"])("stages no acknowledgement when the consumer becomes %s during a read", async (state) => {
    system(); fixture.afterRead = () => {
      if (state === "removed") fixture.currentClaims = {};
      else if (state === "rebound") fixture.currentClaims = { role: "system", consumerId: "urai-studio" };
      else if (state === "disabled") fixture.disabled = true;
      else if (state === "revoked") fixture.revoked = true;
      else if (state === "recreated") fixture.creationTime = "2026-10-08T00:00:00.000Z";
      else fixture.uid = "system-b";
    };
    await expect(ack()).rejects.toMatchObject({ code: ["removed", "rebound", "switched"].includes(state) ? "permission-denied" : "unauthenticated" });
    expect(fixture.writes).toEqual([]);
  });
  it("withholds a successful response when authority is removed after the authorized commit", async () => {
    system(); fixture.afterCommit = () => { fixture.currentClaims = {}; };
    await expect(ack()).rejects.toMatchObject({ code: "permission-denied" });
    // The separate Auth and Firestore services cannot recall a committed receipt.
    expect(fixture.writes).toHaveLength(3);
  });
  it("checks current authority even for an immutable idempotent replay", async () => {
    system(); await ack(); fixture.writes = []; fixture.afterRead = () => { fixture.revoked = true; };
    await expect(ack()).rejects.toMatchObject({ code: "unauthenticated" });
    expect(fixture.writes).toEqual([]);
  });
  it("requires signed Bearer transport and rejects a requested foreign consumer", async () => {
    system(); const input = request(ackData()); delete input.rawRequest;
    await expect(acknowledge(input)).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(acknowledge(request({ ...ackData(), consumerId: "urai-studio" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
  });
});
