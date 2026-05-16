import { afterAll, beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadString } from "firebase/storage";

const PROJECT_ID = process.env.FIREBASE_TEST_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "urai-privacy-integration-test";
const STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
const [storageHost, storagePortRaw] = STORAGE_EMULATOR_HOST.replace(/^https?:\/\//, "").split(":");
const storagePort = Number(storagePortRaw ?? 9199);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: storageHost,
      port: storagePort
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

function storageFor(uid: string, token: Record<string, unknown> = {}) {
  return testEnv.authenticatedContext(uid, token).storage();
}

function anonStorage() {
  return testEnv.unauthenticatedContext().storage();
}

async function seedStorage(path: string, contents = "{}") {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await uploadString(ref(context.storage(), path), contents);
  });
}

describe("Storage export and evidence rules", () => {
  it("allows owners and admins to read user export paths", async () => {
    await seedStorage("exports/user-a/export-1/manifest.json");

    await assertSucceeds(getBytes(ref(storageFor("user-a"), "exports/user-a/export-1/manifest.json")));
    await assertSucceeds(getBytes(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-1/manifest.json")));
  });

  it("denies other users and anonymous users from reading export paths", async () => {
    await seedStorage("exports/user-a/export-1/manifest.json");

    await assertFails(getBytes(ref(storageFor("user-b"), "exports/user-a/export-1/manifest.json")));
    await assertFails(getBytes(ref(anonStorage(), "exports/user-a/export-1/manifest.json")));
  });

  it("allows only admins to write export and evidence objects", async () => {
    await assertFails(uploadString(ref(storageFor("user-a"), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("admin-a", { admin: true }), "evidence/release-lock.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("user-a"), "evidence/release-lock.json"), "{}"));
  });

  it("denies deletes and deny-default paths", async () => {
    await seedStorage("exports/user-a/export-3/manifest.json");

    await assertFails(deleteObject(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-3/manifest.json")));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), "public/open.txt"), "nope"));
  });
});
