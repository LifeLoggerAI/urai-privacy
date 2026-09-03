import { afterAll, beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadString } from "firebase/storage";
import { doc, setDoc, Timestamp } from "firebase/firestore";

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
    await setDoc(doc(context.firestore(), "exportJobs", jobId), {
      uid,
      status: "completed",
      complete: true,
      packageExpiresAt: Timestamp.fromMillis(expiresAt)
    });
  });
}

describe("Storage export and evidence rules", () => {
  it("allows owners and both supported admin claim shapes to read user export paths", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-1/manifest.json");
    await seedCompletedExport("user-a", "export-1");

    await assertSucceeds(getBytes(ref(storageFor("user-a"), "exports/user-a/export-1/manifest.json")));
    await assertSucceeds(getBytes(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-1/manifest.json")));
    await assertSucceeds(getBytes(ref(storageFor("role-admin-a", { role: "admin" }), "exports/user-a/export-1/manifest.json")));
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

  it("allows only either supported admin claim shape to write export and evidence objects", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await assertFails(uploadString(ref(storageFor("user-a"), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("role-admin-a", { role: "admin" }), "exports/user-a/export-role-admin/manifest.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("admin-a", { admin: true }), "evidence/release-lock.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("role-admin-a", { role: "admin" }), "evidence/role-release-lock.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("user-a"), "evidence/release-lock.json"), "{}"));
  });

  it("denies deletes and deny-default paths", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-3/manifest.json");

    await assertFails(deleteObject(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-3/manifest.json")));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), "public/open.txt"), "nope"));
  });
});
