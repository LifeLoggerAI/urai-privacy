import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const QUERY_PAGE_LIMIT = 450;
const DELETABLE_COLLECTIONS = ["privacyRequests", "exportJobs", "consentRecords", "dataAccessEvents"] as const;

export type DeletionCompletionResiduals = {
  uid: string;
  firestoreTargets: Record<string, string[]>;
  storageObjects: string[];
  authUserExists: boolean;
  legalHold: boolean;
  totalResidualTargets: number;
};

export type DeletionCompletionBlock = {
  code: "failed-precondition";
  message: string;
};

export function deletionCompletionBlockReason(
  residuals: DeletionCompletionResiduals
): DeletionCompletionBlock | null {
  if (residuals.legalHold) {
    return {
      code: "failed-precondition",
      message: "Deletion completion cannot be verified because an active legal hold exists."
    };
  }
  if (residuals.totalResidualTargets > 0) {
    return {
      code: "failed-precondition",
      message: "Deletion completion verification found remaining or newly created targets. Re-run the dry run before continuing."
    };
  }
  return null;
}

async function listScopedIds(collectionName: string, uid: string): Promise<string[]> {
  const db = getFirestore();
  const ids: string[] = [];
  let cursor: string | null = null;
  while (true) {
    let query = db.collection(collectionName)
      .where("uid", "==", uid)
      .orderBy(FieldPath.documentId())
      .limit(QUERY_PAGE_LIMIT);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    ids.push(...snapshot.docs.map((doc) => doc.id));
    if (snapshot.size < QUERY_PAGE_LIMIT) return ids.sort();
    cursor = snapshot.docs.at(-1)?.id ?? null;
    if (!cursor) return ids.sort();
  }
}

async function authUserExists(uid: string): Promise<boolean> {
  try {
    await getAuth().getUser(uid);
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (code === "auth/user-not-found") return false;
    throw error;
  }
}

async function activeLegalHold(uid: string): Promise<boolean> {
  const db = getFirestore();
  const [userDoc, holdSnapshot] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("legalHoldRecords")
      .where("uid", "==", uid)
      .where("status", "==", "active")
      .limit(1)
      .get()
  ]);
  return (userDoc.exists && userDoc.data()?.legalHold === true) || !holdSnapshot.empty;
}

export async function collectDeletionCompletionResiduals(
  uid: string
): Promise<DeletionCompletionResiduals> {
  if (!uid.trim()) throw new Error("Deletion completion verification requires a uid.");
  const db = getFirestore();
  const bucket = getStorage().bucket();

  const userDocPromise = db.collection("users").doc(uid).get();
  const collectionPromises = DELETABLE_COLLECTIONS.map(async (collectionName) => [
    collectionName,
    await listScopedIds(collectionName, uid)
  ] as const);
  const deletionPlanPrefix = `privacy-deletion-plans/${createHash("sha256").update(uid).digest("hex")}/`;
  const storagePromise = Promise.all([
    bucket.getFiles({ prefix: `exports/${uid}/` }),
    bucket.getFiles({ prefix: deletionPlanPrefix })
  ]);
  const authPromise = authUserExists(uid);
  const legalHoldPromise = activeLegalHold(uid);

  const [userDoc, collectionEntries, storageResults, authExists, legalHold] = await Promise.all([
    userDocPromise,
    Promise.all(collectionPromises),
    storagePromise,
    authPromise,
    legalHoldPromise
  ]);

  const firestoreTargets: Record<string, string[]> = {
    users: userDoc.exists ? [uid] : [],
    ...Object.fromEntries(collectionEntries)
  };
  const storageObjects = storageResults.flatMap(([files]) => files.map((file) => file.name)).sort();
  const firestoreCount = Object.values(firestoreTargets)
    .reduce((total, ids) => total + ids.length, 0);
  const totalResidualTargets = firestoreCount + storageObjects.length + (authExists ? 1 : 0);

  return {
    uid,
    firestoreTargets,
    storageObjects,
    authUserExists: authExists,
    legalHold,
    totalResidualTargets
  };
}
