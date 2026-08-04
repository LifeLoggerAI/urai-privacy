import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  DELETION_FIRESTORE_SOURCES,
  deletionStoragePaths
} from "./deletion-source-registry";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);
const auth = getAuth(app);
const bucket = getStorage(app).bucket();
const BATCH_SIZE = 400;

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

async function removeFirestoreSource(collection: string, field: string, uid: string) {
  let removed = 0;
  while (true) {
    const page = await db
      .collection(collection)
      .where(field, "==", uid)
      .limit(BATCH_SIZE)
      .get();
    if (page.empty) return removed;

    const batch = db.batch();
    for (const document of page.docs) batch.delete(document.ref);
    await batch.commit();
    removed += page.size;
    if (page.size < BATCH_SIZE) return removed;
  }
}

async function removeStoragePrefix(prefix: string) {
  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) {
    await file.delete({ ignoreNotFound: true });
  }
  return files.length;
}

async function removeAuthAccount(uid: string) {
  try {
    await auth.revokeRefreshTokens(uid);
    await auth.deleteUser(uid);
    return 1;
  } catch (error) {
    if (errorCode(error) === "auth/user-not-found") return 0;
    throw error;
  }
}

async function authAccountExists(uid: string) {
  try {
    await auth.getUser(uid);
    return true;
  } catch (error) {
    if (errorCode(error) === "auth/user-not-found") return false;
    throw error;
  }
}

export async function executeLocalDeletion(uid: string) {
  const firestoreRemoved: Record<string, number> = {};
  for (const source of DELETION_FIRESTORE_SOURCES) {
    firestoreRemoved[source.collection] = await removeFirestoreSource(
      source.collection,
      source.subjectField,
      uid
    );
  }

  const userRef = db.collection("users").doc(uid);
  const user = await userRef.get();
  if (user.exists) await userRef.delete();
  firestoreRemoved.users = user.exists ? 1 : 0;

  const storageRemoved: Record<string, number> = {};
  for (const prefix of deletionStoragePaths(uid)) {
    storageRemoved[prefix] = await removeStoragePrefix(prefix);
  }

  const authRemoved = await removeAuthAccount(uid);
  return { firestoreRemoved, storageRemoved, authRemoved };
}

export async function verifyLocalDeletion(uid: string) {
  const firestoreRemaining: Record<string, number> = {};
  for (const source of DELETION_FIRESTORE_SOURCES) {
    const count = await db
      .collection(source.collection)
      .where(source.subjectField, "==", uid)
      .count()
      .get();
    firestoreRemaining[source.collection] = count.data().count;
  }
  firestoreRemaining.users = (await db.collection("users").doc(uid).get()).exists ? 1 : 0;

  const storageRemaining: Record<string, number> = {};
  for (const prefix of deletionStoragePaths(uid)) {
    const [files] = await bucket.getFiles({ prefix });
    storageRemaining[prefix] = files.length;
  }

  const authRemaining = (await authAccountExists(uid)) ? 1 : 0;
  const remaining =
    Object.values(firestoreRemaining).reduce((total, count) => total + count, 0) +
    Object.values(storageRemaining).reduce((total, count) => total + count, 0) +
    authRemaining;

  return {
    verified: remaining === 0,
    remaining,
    firestoreRemaining,
    storageRemaining,
    authRemaining
  };
}
