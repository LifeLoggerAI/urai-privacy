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
  it("denies all direct owner and admin reads of export packages", async ({ skip }) => {
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

  it("revokes all client export downloads after an active deletion tombstone", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-r326-deletion/export-deleting/manifest.json");
    await seedStorage("exports/user-r326-deletion/export-deleting/export.json");
    await seedCompletedExport("user-r326-deletion", "export-deleting");
    await requireStorageEnv().withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "privacyDeletionTombstones", "user-r326-deletion"), {
        active: true, uid: "user-r326-deletion", reason: "user deletion",
      });
    });
    for (const client of [
      storageFor("user-r326-deletion"),
      storageFor("claim-admin", { admin: true }),
      storageFor("role-claim-admin", { role: "admin" }),
    ]) {
      for (const name of ["manifest.json", "export.json"]) {
        await assertFails(getBytes(ref(client, "exports/user-r326-deletion/export-deleting/" + name)));
      }
    }
  });

  it("rejects admin-claim export artifact writes after deletion becomes active", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-r327-deletion/delete-locked/manifest.json");
    await seedCompletedExport("user-r327-deletion", "delete-locked");
    await requireStorageEnv().withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "privacyDeletionTombstones", "user-r327-deletion"), {
        active: true, uid: "user-r327-deletion", reason: "user deletion",
      });
    });
    for (const client of [
      storageFor("claim-admin-after-delete", { admin: true }),
      storageFor("role-admin-after-delete", { role: "admin" }),
    ]) {
      await assertFails(uploadString(ref(client, "exports/user-r327-deletion/delete-locked/manifest.json"), "forged-overwrite"));
      await assertFails(uploadString(ref(client, "exports/user-r327-deletion/delete-locked/export.json"), "forged-new-export"));
    }
  });

  it("rejects malformed deletion tombstones without an explicit inactive state", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-r327-malformed/malformed-delete/manifest.json");
    await seedCompletedExport("user-r327-malformed", "malformed-delete");
    await requireStorageEnv().withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "privacyDeletionTombstones", "user-r327-malformed"), {
        uid: "user-r327-malformed", reason: "incomplete tombstone",
      });
    });
    await assertFails(getBytes(ref(storageFor("user-r327-malformed"), "exports/user-r327-malformed/malformed-delete/manifest.json")));
    await assertFails(uploadString(
      ref(storageFor("claim-admin-malformed", { admin: true }), "exports/user-r327-malformed/malformed-delete/manifest.json"),
      "forged-overwrite",
    ));
  });

  it("blocks export reads and writes on malformed deletion tombstones or in-flight planning", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    const uid = "user-genesis-strict-export";
    const jobId = "genesis-export";
    const objectPath = `exports/${uid}/${jobId}/manifest.json`;
    await seedStorage(objectPath);
    await seedCompletedExport(uid, jobId);

    const tombstones: Array<Record<string, unknown>> = [
      {}, { active: null }, { active: "false" }, { active: 0 }, { active: true },
      { active: false, deletionPlanningLeaseToken: "pending-lease" },
      { active: false, deletionPlanningLeaseUntil: "2026-11-03T05:00:00.000Z" },
      { active: false, deletionPlanningLeaseRequestId: "request-a" },
      { active: false, deletionPlanningLeaseOperation: "dryRun" },
      { active: false, deletionPlanningLeaseBy: "executor-a" }
    ];

    for (const tombstone of tombstones) {
      await requireStorageEnv().withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), "privacyDeletionTombstones", uid), tombstone);
      });
      for (const client of [
        storageFor(uid),
        storageFor("claim-admin", { admin: true }),
        storageFor("role-claim-admin", { role: "admin" })
      ]) {
        await assertFails(getBytes(ref(client, objectPath)));
      }
      await assertFails(uploadString(ref(storageFor("claim-admin", { admin: true }), objectPath), "invalid-write"));
    }

    // Even a verified inactive tombstone must NOT open a direct Storage export path.
    // A current consent-bound streaming broker is the sole authorized download channel.
    await requireStorageEnv().withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "privacyDeletionTombstones", uid), { active: false });
    });
    await assertFails(getBytes(ref(storageFor(uid), objectPath)));
    await assertFails(getBytes(ref(storageFor("claim-admin", { admin: true }), objectPath)));
  });

  it("denies other users and anonymous users from reading export paths", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-1/manifest.json");

    await assertFails(getBytes(ref(storageFor("user-b"), "exports/user-a/export-1/manifest.json")));
    await assertFails(getBytes(ref(anonStorage(), "exports/user-a/export-1/manifest.json")));
  });

  it("denies all client export writes while retaining admin-only evidence permissions", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await assertFails(uploadString(ref(storageFor("user-a"), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-2/manifest.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("role-admin-a", { role: "admin" }), "exports/user-a/export-role-admin/manifest.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("admin-a", { admin: true }), "evidence/release-lock.json"), "{}"));
    await assertSucceeds(uploadString(ref(storageFor("role-admin-a", { role: "admin" }), "evidence/role-release-lock.json"), "{}"));
    await assertFails(uploadString(ref(storageFor("user-a"), "evidence/release-lock.json"), "{}"));
  });

  it("keeps Life Movie source and render objects inaccessible to clients, including admins", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    const privatePaths = [
      "tenants/tenant-a/life-movies/project-a/renders/movie.mp4",
      "tenants/tenant-a/life-movies/project-a/segments/0000/movie.mp4",
      "studios/tenant-a/life-movies/project-a/final/movie.mp4",
      "tenants/tenant-a/source-recordings/audio.wav"
    ];
    for (const objectPath of privatePaths) {
      await seedStorage(objectPath, "private-fixture");
      for (const client of [
        anonStorage(),
        storageFor("user-a"),
        storageFor("user-b"),
        storageFor("claim-admin", { admin: true }),
        storageFor("role-claim-admin", { role: "admin" })
      ]) {
        const target = ref(client, objectPath);
        await assertFails(getBytes(target));
        await assertFails(uploadString(target, "forged"));
        await assertFails(deleteObject(target));
      }
    }
  });

  it("denies deletes and deny-default paths", async ({ skip }) => {
    if (!storageRulesAvailable) return skip();
    await seedStorage("exports/user-a/export-3/manifest.json");

    await assertFails(deleteObject(ref(storageFor("admin-a", { admin: true }), "exports/user-a/export-3/manifest.json")));
    await assertFails(uploadString(ref(storageFor("admin-a", { admin: true }), "public/open.txt"), "nope"));
  });
});
