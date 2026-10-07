import { afterAll, beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadString } from "firebase/storage";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const PROJECT_ID = process.env.FIREBASE_TEST_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "urai-privacy-integration-test";
const STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
const [storageHost, storagePortRaw] = STORAGE_EMULATOR_HOST.replace(/^https?:\/\//, "").split(":");
const storagePort = Number(storagePortRaw ?? 9199);
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [firestoreHost, firestorePortRaw] = FIRESTORE_EMULATOR_HOST.replace(/^https?:\/\//, "").split(":");
const firestorePort = Number(firestorePortRaw ?? 8080);
const RELEASE_VERIFY = process.env.URAI_RELEASE_VERIFY === "1";

let testEnv: RulesTestEnvironment | undefined;
let storageRulesAvailable = false;

beforeAll(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        rules: readFileSync("storage.rules", "utf8"),
        host: storageHost,
        port: storagePort
      },
      firestore: { rules: readFileSync("firestore.rules", "utf8"), host: firestoreHost, port: firestorePort }
    });
    storageRulesAvailable = true;
  } catch (error) {
    storageRulesAvailable = false;
    const message = error instanceof Error ? error.message : String(error);

    if (RELEASE_VERIFY) {
      throw new Error(`[storage.rules.test] Release verification requires a running Storage emulator at ${STORAGE_EMULATOR_HOST}. Cause: ${message}`);
    }

    console.warn(`[storage.rules.test] Storage emulator unavailable at ${STORAGE_EMULATOR_HOST}; skipping emulator-backed storage rules tests. Run npm run test:emulators for full rules coverage. Cause: ${message}`);
  }
});

afterAll(async () => {
  await testEnv?.cleanup();
});

function requireStorageEnv(): RulesTestEnvironment {
  if (!testEnv || !storageRulesAvailable) {
    throw new Error("Storage emulator test environment is unavailable; this test should have been skipped.");
  }
  return testEnv;
}

function storageFor(uid: string, token: Record<string, unknown> = {}) {
  return requireStorageEnv().authenticatedContext(uid, token).storage();
}

function anonStorage() {
  return requireStorageEnv().unauthenticatedContext().storage();
}

async function seedStorage(path: string, contents = "{}") {
  await requireStorageEnv().withSecurityRulesDisabled(async (context) => {
    await uploadString(ref(context.storage(), path), contents);
  });
}

async function seedCompletedExport(uid: string, jobId: string, expiresAt = Date.now() + 60_000) {
  await requireStorageEnv().withSecurityRulesDisabled(async (context) => {
    const consentDeadline = Timestamp.fromMillis(Date.now() + 3_600_000);
    await setDoc(doc(context.firestore(), "privacyDeletionTombstones", uid), {
      uid, active: false, exportConsentStatus: "granted", exportConsentPolicyVersion: "1.0.0",
      exportConsentReceiptHash: "a".repeat(64), exportConsentExpiresAt: consentDeadline
    });
    await setDoc(doc(context.firestore(), "exportJobs", jobId), {
      uid,
      status: "completed",
      complete: true,
      exportPackagePath: `exports/${uid}/${jobId}/export.json`,
      exportManifestPath: `exports/${uid}/${jobId}/manifest.json`,
      packageExpiresAt: Timestamp.fromMillis(expiresAt),
      consentReceiptHash: "a".repeat(64), exportConsentExpiresAt: consentDeadline
    });
  });
}

describe("Storage export and evidence rules", () => {
  it("applies real callable consent withdrawal to completed export reads", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
    const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";
    const signUpResponse = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic-test`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
    });
    if (!signUpResponse.ok) throw new Error("Synthetic Auth emulator sign-up failed.");
    const identity = await signUpResponse.json() as { localId: string; idToken: string };
    const callConsent = async (status: "granted" | "revoked") => {
      const response = await fetch(`http://${functionsHost}/${PROJECT_ID}/us-central1/setCanonicalConsent`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${identity.idToken}` },
        body: JSON.stringify({ data: { purpose: "data.export", status, surface: "synthetic-emulator-proof" } })
      });
      if (!response.ok) throw new Error(`Canonical consent callable rejected the synthetic ${status} request.`);
      const body = await response.json() as { result: { receiptHash: string; expiresAt: string | null } };
      if (!body.result?.receiptHash) throw new Error("Canonical consent callable returned no receipt.");
      return body.result;
    };
    const grant = await callConsent("granted");
    const uid = identity.localId;
    const jobId = `runtime-${uid}`;
    const path = `exports/${uid}/${jobId}/manifest.json`;
    await seedStorage(path, JSON.stringify({ synthetic: true }));
    await requireStorageEnv().withSecurityRulesDisabled(async (context) => {
      const fence = (await getDoc(doc(context.firestore(), "privacyDeletionTombstones", uid))).data();
      if (fence?.exportConsentReceiptHash !== grant.receiptHash) throw new Error("Runtime receipt projection differs from canonical consent.");
      await setDoc(doc(context.firestore(), "exportJobs", jobId), {
        uid, requestId: `request-${uid}`, status: "completed", complete: true,
        exportPackagePath: `exports/${uid}/${jobId}/export.json`, exportManifestPath: path,
        packageExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
        consentReceiptHash: grant.receiptHash, exportConsentExpiresAt: Timestamp.fromMillis(Date.parse(grant.expiresAt!))
      });
      await setDoc(doc(context.firestore(), "privacyRequests", `request-${uid}`), { uid, type: "export", status: "completed" });
    });
    await assertFails(getBytes(ref(storageFor(uid), path)));
    const descriptorResponse = await fetch(`http://${functionsHost}/${PROJECT_ID}/us-central1/getExportDownloadUrl`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${identity.idToken}` },
      body: JSON.stringify({ data: { jobId, file: "manifest" } })
    });
    if (!descriptorResponse.ok) throw new Error("The real download descriptor callable rejected a current synthetic grant.");
    const descriptor = (await descriptorResponse.json() as { result: { url: string } }).result;
    const accepted = await fetch(descriptor.url, { headers: { Authorization: `Bearer ${identity.idToken}` } });
    if (!accepted.ok || await accepted.text() !== JSON.stringify({ synthetic: true })) throw new Error("The authenticated export endpoint did not return the synthetic source.");
    const anonymous = await fetch(descriptor.url);
    if (anonymous.status !== 401) throw new Error("The authenticated export endpoint admitted an anonymous caller.");
    await callConsent("revoked");
    await assertFails(getBytes(ref(storageFor(uid), path)));
    await assertFails(getBytes(ref(storageFor("admin-a", { admin: true }), path)));
    const withdrawn = await fetch(descriptor.url, { headers: { Authorization: `Bearer ${identity.idToken}` } });
    if (withdrawn.status !== 409) throw new Error("An earlier descriptor survived canonical consent withdrawal.");
  });

  it("denies direct Storage reads even for owners and both admin claim shapes", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-1/manifest.json");
    await seedCompletedExport("user-a", "export-1");

    await assertFails(getBytes(ref(storageFor("user-a"), "exports/user-a/export-1/manifest.json")));
    await assertFails(getBytes(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-1/manifest.json")));
    await assertFails(getBytes(ref(storageFor("role-admin-a", { role: "admin" }), "exports/user-a/export-1/manifest.json")));
  });

  it("denies direct owner reads after package expiry", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-expired/manifest.json");
    await seedCompletedExport("user-a", "export-expired", Date.now() - 60_000);
    await assertFails(getBytes(ref(storageFor("user-a"), "exports/user-a/export-expired/manifest.json")));
  });

  it("denies other users and anonymous users from reading export paths", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-1/manifest.json");

    await assertFails(getBytes(ref(storageFor("user-b"), "exports/user-a/export-1/manifest.json")));
    await assertFails(getBytes(ref(anonStorage(), "exports/user-a/export-1/manifest.json")));
  });

  it("permits only trusted server exports and either admin claim shape for evidence writes", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await assertFails(uploadString(ref(storageFor("user-a"), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("role-admin-a", { role: "admin" }), "exports/user-a/export-role-admin/manifest.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("admin-a", { admin: true }), "evidence/release-lock.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("role-admin-a", { role: "admin" }), "evidence/role-release-lock.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("user-a"), "evidence/release-lock.json"), "{}"));
  });

  it("requires guarded Function delivery for published, stale and legacy export objects", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    const active = "exports/user-a/attempt-job/current/manifest.json";
    const stale = "exports/user-a/attempt-job/stale/manifest.json";
    const legacy = "exports/user-a/attempt-job/manifest.json";
    for (const path of [active, stale, legacy]) await seedStorage(path);
    await seedCompletedExport("user-a", "attempt-job");
    await requireStorageEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "exportJobs", "attempt-job"), {
        uid: "user-a", status: "completed", complete: true,
        packageExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
        exportPackagePath: "exports/user-a/attempt-job/current/export.json",
        exportManifestPath: active
      }, { merge: true });
    });
    await assertFails(getBytes(ref(storageFor("user-a"), active)));
    await assertFails(getBytes(ref(storageFor("admin-a", { admin: true }), active)));
    await assertFails(getBytes(ref(storageFor("user-a"), stale)));
    await assertFails(getBytes(ref(storageFor("admin-a", { admin: true }), stale)));
    await assertFails(getBytes(ref(storageFor("user-a"), legacy)));
    await assertFails(getBytes(ref(storageFor("user-b"), active)));
    await assertFails(getBytes(ref(anonStorage(), active)));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), active), "overwrite"));
  });

  it("denies completed exports immediately when consent changes or account deletion fences the subject", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    const path = "exports/user-a/fenced-job/manifest.json";
    await seedStorage(path);
    for (const override of [
      { exportConsentStatus: "revoked" },
      { exportConsentReceiptHash: "b".repeat(64) },
      { exportConsentExpiresAt: Timestamp.fromMillis(Date.now() - 1) },
      { active: true },
      { exportConsentPolicyVersion: "obsolete" }
    ]) {
      await seedCompletedExport("user-a", "fenced-job");
      await requireStorageEnv().withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "privacyDeletionTombstones", "user-a"), override, { merge: true });
      });
      await assertFails(getBytes(ref(storageFor("user-a"), path)));
      await assertFails(getBytes(ref(storageFor("admin-a", { admin: true }), path)));
    }
  });

  it("denies deletes and deny-default paths", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-3/manifest.json");

    await assertFails(deleteObject(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-3/manifest.json")));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), "public/open.txt"), "nope"));
  });
});
