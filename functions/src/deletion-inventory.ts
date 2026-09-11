import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  DELETION_ADAPTERS,
  DELETION_MANIFEST_VERSION,
  deletionSubjectHash,
  type DeletionManifest
} from "./deletion-contract";
import {
  DELETION_FIRESTORE_SOURCES,
  DELETION_RETENTION_RULES,
  deletionStoragePaths
} from "./deletion-source-registry";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);
const auth = getAuth(app);
const bucket = getStorage(app).bucket();

async function countCollection(collection: string, field: string, uid: string) {
  const aggregate = await db.collection(collection).where(field, "==", uid).count().get();
  return aggregate.data().count;
}

async function authAccountExists(uid: string) {
  try {
    await auth.getUser(uid);
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "auth/user-not-found") return false;
    throw error;
  }
}

async function legalHoldStatus(uid: string) {
  const [user, hold] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db
      .collection("legalHoldRecords")
      .where("uid", "==", uid)
      .where("status", "==", "active")
      .limit(1)
      .get()
  ]);
  return (user.exists && user.data()?.legalHold === true) || !hold.empty;
}

export async function inventoryDeletionSubject(uid: string, requestId: string) {
  const firestoreCounts = Object.fromEntries(
    await Promise.all(
      DELETION_FIRESTORE_SOURCES.map(async (source) => [
        source.collection,
        await countCollection(source.collection, source.subjectField, uid)
      ])
    )
  ) as Record<string, number>;

  const userDocumentExists = (await db.collection("users").doc(uid).get()).exists;
  const storagePrefixes = deletionStoragePaths(uid);
  const storageCounts = Object.fromEntries(
    await Promise.all(
      storagePrefixes.map(async (prefix) => {
        const [files] = await bucket.getFiles({ prefix });
        return [prefix, files.length];
      })
    )
  ) as Record<string, number>;
  const [authExists, legalHold] = await Promise.all([
    authAccountExists(uid),
    legalHoldStatus(uid)
  ]);

  const firestoreItemCount =
    Object.values(firestoreCounts).reduce((total, count) => total + count, 0) +
    (userDocumentExists ? 1 : 0);
  const storageItemCount = Object.values(storageCounts).reduce(
    (total, count) => total + count,
    0
  );

  const manifest: DeletionManifest = {
    version: DELETION_MANIFEST_VERSION,
    subjectHash: deletionSubjectHash(uid),
    requestId,
    legalHold,
    adapters: DELETION_ADAPTERS.map((adapter) => ({
      adapterId: adapter.id,
      system: adapter.system,
      status: adapter.status,
      itemCount:
        adapter.id === "urai-privacy-firestore"
          ? firestoreItemCount
          : adapter.id === "urai-privacy-storage"
            ? storageItemCount
            : adapter.id === "firebase-auth"
              ? authExists
                ? 1
                : 0
              : null,
      reason: adapter.status === "pending" ? "ADAPTER_NOT_INTEGRATED" : undefined
    }))
  };

  return {
    manifest,
    inventory: {
      firestoreCounts,
      userDocumentExists,
      storageCounts,
      authAccountExists: authExists,
      retentionRules: DELETION_RETENTION_RULES
    }
  };
}
