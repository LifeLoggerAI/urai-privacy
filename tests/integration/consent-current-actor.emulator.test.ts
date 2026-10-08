import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const PROJECT = "urai-privacy-integration-test";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const loopback = (host: string | undefined) => !!host && /^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host);
const emulated = loopback(authHost) && loopback(firestoreHost);
const strict = process.env.URAI_RELEASE_VERIFY === "1";
if (strict && !emulated) throw new Error("Consent actor proof requires isolated loopback Auth and Firestore emulators.");

type Actor = { uid: string; token: string };
let app: App;
let auth: Auth;
let db: Firestore;
const actors: Actor[] = [];
let owner: Actor;
let administrator: Actor;
let consumer: Actor;
let unsignedAdmin: Actor;
let unsignedConsumer: Actor;

async function actor(label: string, claims: Record<string, unknown> = {}): Promise<Actor> {
  const uid = `consent-proof-${label}-${randomUUID()}`;
  const email = `${uid}@example.invalid`;
  const password = randomUUID();
  await auth.createUser({ uid, email, password });
  await auth.setCustomUserClaims(uid, claims);
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic-local-only`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  if (!response.ok) throw new Error("Disposable loopback test authentication failed.");
  const value = await response.json() as { idToken?: unknown; localId?: unknown };
  if (typeof value.idToken !== "string" || value.localId !== uid) {
    throw new Error("Disposable test authentication returned no matching identity.");
  }
  const result = { uid, token: value.idToken };
  actors.push(result);
  return result;
}

async function call(name: "setCanonicalConsent" | "evaluateCanonicalConsent", actor: Actor, data: Record<string, unknown>) {
  const response = await fetch(`http://127.0.0.1:5001/${PROJECT}/us-central1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${actor.token}` },
    body: JSON.stringify({ data })
  });
  const body = await response.json() as { result?: Record<string, unknown>; error?: { status?: string } };
  return { status: response.status, result: body.result, error: body.error?.status };
}
const decide = (actor: Actor) => call("evaluateCanonicalConsent", actor, {
  purpose: "data.export", targetUid: owner.uid, correlationId: randomUUID()
});
async function accessCount(actor: Actor) {
  return (await db.collection("dataAccessEvents").where("actorUid", "==", actor.uid).get()).size;
}
async function deniedDecision(actor: Actor) {
  const before = await accessCount(actor);
  const reply = await decide(actor);
  expect(reply.status).toBe(403);
  expect(reply.error).toBe("PERMISSION_DENIED");
  expect(reply.result).toBeUndefined();
  expect(await accessCount(actor)).toBe(before);
}

(emulated ? describe : describe.skip)("loaded canonical consent callable with real emulator account authority", () => {
  beforeAll(async () => {
    if (!emulated || process.env.GCLOUD_PROJECT !== PROJECT) {
      throw new Error("Consent actor proof refuses non-loopback or unexpected project identity.");
    }
    app = initializeApp({ projectId: PROJECT }, `consent-actor-proof-${randomUUID()}`);
    auth = getAuth(app);
    db = getFirestore(app);
    owner = await actor("owner");
    administrator = await actor("admin", { admin: true });
    consumer = await actor("consumer", { role: "system", consumerId: "urai-jobs" });
    unsignedAdmin = await actor("unsigned-admin");
    unsignedConsumer = await actor("unsigned-consumer");
  }, 30_000);

  afterAll(async () => {
    if (!app) return;
    // Remove only this suite's disposable records; never clear the database.
    for (const actor of actors) {
      for (const [collection, field] of [
        ["consentRecords", "uid"], ["consentEvents", "uid"],
        ["dataAccessEvents", "actorUid"], ["auditLogs", "actorUid"]
      ]) {
        const rows = await db.collection(collection).where(field, "==", actor.uid).get();
        for (const row of rows.docs) await row.ref.delete();
      }
      await db.collection("privacyDeletionTombstones").doc(actor.uid).delete();
      await auth.deleteUser(actor.uid);
    }
    await deleteApp(app);
  }, 30_000);

  it("grants and evaluates the real owner's consent through callable middleware", async () => {
    const grant = await call("setCanonicalConsent", owner, { purpose: "data.export", status: "granted" });
    expect(grant.status).toBe(200); expect(grant.result?.status).toBe("granted");
    const reply = await decide(owner);
    expect(reply.status).toBe(200); expect(reply.result?.allowed).toBe(true);
    expect(await accessCount(owner)).toBe(1);
  });
  it("allows the signed and currently authorized administrator", async () => {
    const reply = await decide(administrator);
    expect(reply.status).toBe(200); expect(reply.result?.allowed).toBe(true);
  });
  it("denies a removed administrator whose old signed token still has the admin claim", async () => {
    expect((await auth.verifyIdToken(administrator.token)).admin).toBe(true);
    await auth.setCustomUserClaims(administrator.uid, {});
    await deniedDecision(administrator);
  });
  it("denies a newly assigned admin claim missing from the old signed token", async () => {
    await auth.setCustomUserClaims(unsignedAdmin.uid, { admin: true });
    await deniedDecision(unsignedAdmin);
  });
  it("allows the signed and current exact system consumer", async () => {
    const reply = await decide(consumer);
    expect(reply.status).toBe(200); expect(reply.result?.allowed).toBe(true);
  });
  it("denies a consumer rebound while its old signed token retains the prior consumer", async () => {
    expect((await auth.verifyIdToken(consumer.token)).consumerId).toBe("urai-jobs");
    await auth.setCustomUserClaims(consumer.uid, { role: "system", consumerId: "urai-studio" });
    await deniedDecision(consumer);
  });
  it("denies current-only system access absent from the old signed token", async () => {
    await auth.setCustomUserClaims(unsignedConsumer.uid, { role: "system", consumerId: "urai-jobs" });
    await deniedDecision(unsignedConsumer);
  });
  it("denies a disabled owner without changing its existing consent receipt", async () => {
    const ref = db.collection("consentRecords").doc(`${owner.uid}_data_export`);
    const before = (await ref.get()).data()?.receiptHash;
    await auth.updateUser(owner.uid, { disabled: true });
    const reply = await call("setCanonicalConsent", owner, { purpose: "data.export", status: "revoked" });
    expect(reply.status).toBe(401); expect(reply.result).toBeUndefined();
    expect((await ref.get()).data()?.receiptHash).toBe(before);
  });
});
