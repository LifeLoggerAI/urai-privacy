import { afterAll, beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadString } from "firebase/storage";

const PROJECT_ID = "urai-privacy-storage-rules-test";
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "localhost",
      port: 9199
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

describe("Storage export and evidence rules", () => {
  it("allows owners and admins to read user export paths", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadString(ref(context.storage(), "exports/user-a/export-1/manifest.json"), "{}");
    });

    await assertSucceeds(getBytes(ref(storageFor("user-a"), "exports/user-a/export-1/manifest.json")));
    await assertSucceeds(getBytes(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-1/manifest.json")));
  });

  it("denies other users and anonymous users from reading export paths", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadString(ref(context.storage(), "exports/user-a/export-1/manifest.json"), "{}");
    });

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
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadString(ref(context.storage(), "exports/user-a/export-3/manifest.json"), "{}");
    });

    await assertFails(deleteObject(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-3/manifest.json")));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), "public/open.txt"), "nope"));
  });
});
