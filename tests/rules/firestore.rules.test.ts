import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = process.env.FIREBASE_TEST_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "urai-privacy-integration-test";
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [firestoreHost, firestorePortRaw] = FIRESTORE_EMULATOR_HOST.replace(/^https?:\/\//, "").split(":");
const firestorePort = Number(firestorePortRaw ?? 8080);
const RELEASE_VERIFY = process.env.URAI_RELEASE_VERIFY === "1";

let testEnv: RulesTestEnvironment | undefined;
let firestoreRulesAvailable = false;

beforeAll(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: firestoreHost,
        port: firestorePort,
        rules: readFileSync("firestore.rules", "utf8")
      }
    });
    firestoreRulesAvailable = true;
  } catch (error) {
    firestoreRulesAvailable = false;
    const message = error instanceof Error ? error.message : String(error);

    if (RELEASE_VERIFY) {
      throw new Error(`[firestore.rules.test] Release verification requires a running Firestore emulator at ${FIRESTORE_EMULATOR_HOST}. Cause: ${message}`);
    }

    console.warn(`[firestore.rules.test] Firestore emulator unavailable at ${FIRESTORE_EMULATOR_HOST}; skipping emulator-backed Firestore rules tests. Run npm run test:emulators for full rules coverage. Cause: ${message}`);
  }
});

beforeEach(async ({ skip }) => {
  if (!firestoreRulesAvailable || !testEnv) return skip();
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/admin-a"), { uid: "admin-a", role: "admin" });
    await setDoc(doc(context.firestore(), "users/user-a"), { uid: "user-a", role: "user" });
    await setDoc(doc(context.firestore(), "users/user-b"), { uid: "user-b", role: "user" });
    await setDoc(doc(context.firestore(), "privacyRequests/preq-a"), { uid: "user-a", type: "export", status: "pending" });
    await setDoc(doc(context.firestore(), "deletionRequests/del-a"), { uid: "user-a", status: "pending" });
    await setDoc(doc(context.firestore(), "consentRecords/consent-a"), { uid: "user-a", status: "granted", purpose: "ai_insights" });
    await setDoc(doc(context.firestore(), "consentEvents/consent-event-a"), { uid: "user-a", status: "granted", purpose: "ai_insights" });
    await setDoc(doc(context.firestore(), "auditLogs/audit-a"), { actorUid: "admin-a", targetUid: "user-a", action: "admin_viewed_request" });
    await setDoc(doc(context.firestore(), "dataAccessEvents/data-a"), { uid: "user-a", actorUid: "admin-a", outcome: "allowed" });
    await setDoc(doc(context.firestore(), "retentionPolicies/r1"), { collection: "auditLogs", retentionClass: "R5" });
    await setDoc(doc(context.firestore(), "policyVersions/v1"), { version: "0.1.0-draft", status: "published" });
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

function requireFirestoreEnv(): RulesTestEnvironment {
  if (!testEnv || !firestoreRulesAvailable) {
    throw new Error("Firestore emulator test environment is unavailable; this test should have been skipped.");
  }
  return testEnv;
}

function authed(uid: string, token: Record<string, unknown> = {}) {
  return requireFirestoreEnv().authenticatedContext(uid, token).firestore();
}

function anon() {
  return requireFirestoreEnv().unauthenticatedContext().firestore();
}

describe("Firestore owner/admin privacy rules", () => {
  it("allows owners to read their own user and privacy request records", async () => {
    await assertSucceeds(getDoc(doc(authed("user-a"), "users/user-a")));
    await assertSucceeds(getDoc(doc(authed("user-a"), "privacyRequests/preq-a")));
  });

  it("denies users reading another user's private records", async () => {
    await assertFails(getDoc(doc(authed("user-b"), "users/user-a")));
    await assertFails(getDoc(doc(authed("user-b"), "privacyRequests/preq-a")));
    await assertFails(getDoc(doc(authed("user-b"), "consentRecords/consent-a")));
  });

  it("allows admin custom claim and admin role document reads", async () => {
    await assertSucceeds(getDoc(doc(authed("claim-admin", { admin: true }), "privacyRequests/preq-a")));
    await assertSucceeds(getDoc(doc(authed("admin-a"), "privacyRequests/preq-a")));
  });

  it("allows users to create only their own pending privacy and deletion requests", async () => {
    await assertSucceeds(setDoc(doc(authed("user-a"), "privacyRequests/preq-new"), { uid: "user-a", type: "export", status: "pending" }));
    await assertFails(setDoc(doc(authed("user-a"), "privacyRequests/preq-bad-owner"), { uid: "user-b", type: "export", status: "pending" }));
    await assertFails(setDoc(doc(authed("user-a"), "privacyRequests/preq-bad-status"), { uid: "user-a", type: "export", status: "approved" }));
    await assertSucceeds(setDoc(doc(authed("user-a"), "deletionRequests/del-new"), { uid: "user-a", status: "pending" }));
  });

  it("allows only admins to update request status", async () => {
    await assertFails(updateDoc(doc(authed("user-a"), "privacyRequests/preq-a"), { status: "approved" }));
    await assertSucceeds(updateDoc(doc(authed("admin-a"), "privacyRequests/preq-a"), { status: "approved" }));
  });

  it("protects audit logs and consent events as append-only evidence", async () => {
    await assertSucceeds(getDoc(doc(authed("user-a"), "auditLogs/audit-a")));
    await assertSucceeds(getDoc(doc(authed("user-a"), "consentEvents/consent-event-a")));
    await assertFails(setDoc(doc(authed("user-a"), "auditLogs/audit-user-created"), { actorUid: "user-a", targetUid: "user-a" }));
    await assertSucceeds(setDoc(doc(authed("admin-a"), "auditLogs/audit-admin-created"), { actorUid: "admin-a", targetUid: "user-a" }));
    await assertFails(updateDoc(doc(authed("admin-a"), "auditLogs/audit-a"), { action: "tampered" }));
    await assertFails(deleteDoc(doc(authed("admin-a"), "auditLogs/audit-a")));
    await assertFails(updateDoc(doc(authed("admin-a"), "consentEvents/consent-event-a"), { status: "tampered" }));
  });

  it("denies anonymous access and unknown collections", async () => {
    await assertFails(getDoc(doc(anon(), "users/user-a")));
    await assertFails(setDoc(doc(authed("admin-a"), "unknown/private"), { value: true }));
  });
});
