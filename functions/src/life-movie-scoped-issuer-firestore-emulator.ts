import type { App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type {
  ReviewOnlyMovieGrantBackend,
  ReviewOnlyMovieGrantTransaction,
} from "./life-movie-scoped-issuer-review";

/**
 * FIREBASE-EMULATOR-ONLY adapter for transaction-level acceptance tests.
 *
 * NOT an approved consent issuer or production provider. It has no HTTP route,
 * Firebase Functions export, provisioning/issuer authority or Jobs wiring.
 * The "reviewOnly" evidence records are synthetic and MUST NOT be treated as
 * independently verified production owner notices, grants or media rights.
 *
 * The intentionally strict local environment guard prevents using this
 * adapter against production Firestore, even if someone imports it later.
 */
const PROJECT = "demo-urai-privacy-integration-test";
const DENIED = "life_movie_review_only_emulator_authority_unavailable";
const LOCAL = {
  URAI_EMULATOR_PROJECT: PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
} as const;

function localOnly(app: App): void {
  for (const [name, expected] of Object.entries(LOCAL)) {
    if (process.env[name] !== expected) throw new Error(DENIED);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_TOKEN ||
      (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT) ||
      (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== PROJECT) ||
      !app || app.options.projectId !== PROJECT) {
    throw new Error(DENIED);
  }
}

/**
 * Accepts an actual Firebase Auth emulator ID token; Admin checks token
 * revocation and disabled state. This test-only dependency MUST be replaced
 * by an independently approved onCall identity and source evidence authority
 * before any live grant may ever be considered.
 */
export function createEmulatorOnlyReviewMovieGrantBackend(input: Readonly<{
  app: App;
  ownerIdToken: string;
  nowMs: () => number;
}>): ReviewOnlyMovieGrantBackend {
  if (!input || typeof input !== "object" ||
      !input.app || typeof input.ownerIdToken !== "string" ||
      input.ownerIdToken.length < 10 || typeof input.nowMs !== "function") {
    throw new Error(DENIED);
  }
  localOnly(input.app);
  const db = getFirestore(input.app);
  const auth = getAuth(input.app);
  const read = (tx: FirebaseFirestore.Transaction, collection: string, key: string) =>
    tx.get(db.collection(collection).doc(key)).then((snapshot) =>
      snapshot.exists ? snapshot.data() ?? null : null);

  return Object.freeze({
    async verifiedActiveOwnerUid(): Promise<string> {
      localOnly(input.app);
      const token = await auth.verifyIdToken(input.ownerIdToken, true);
      if (!token || typeof token.uid !== "string" || !token.uid) throw new Error(DENIED);
      const account = await auth.getUser(token.uid);
      if (account.disabled) throw new Error(DENIED);
      return token.uid;
    },
    nowMs: input.nowMs,
    async runTransaction<T>(
      fn: (tx: ReviewOnlyMovieGrantTransaction) => Promise<T>,
    ): Promise<T> {
      localOnly(input.app);
      return db.runTransaction(async (tx) => {
        const facade: ReviewOnlyMovieGrantTransaction = Object.freeze({
          readOwnerProfile: (ownerUid) => read(tx, "users", ownerUid),
          readDeletionTombstone: (ownerUid) =>
            tx.get(db.collection("privacyDeletionTombstones").doc(ownerUid)),
          readExistingGrant: (recordId) => read(tx, "consentRecords", recordId),
          readReviewedNotice: (id) => read(tx, "reviewOnlyMovieNotices", id),
          readOwnerApproval: (id) => read(tx, "reviewOnlyMovieApprovals", id),
          readVerifiedSelection: (id) => read(tx, "reviewOnlyMovieSelections", id),
          readVerifiedSourceRights: (id) => read(tx, "reviewOnlyMovieRights", id),
          createGrant: (recordId, record) => tx.create(
            db.collection("consentRecords").doc(recordId),
            { ...record, reviewOnlyEmulator: true, productionAuthorized: false },
          ),
          createAudit: (eventId, audit) => tx.create(
            db.collection("auditLogs").doc(eventId),
            { ...audit, reviewOnlyEmulator: true, productionAuthorized: false },
          ),
        });
        return fn(facade);
      }, { maxAttempts: 5 });
    },
  } satisfies ReviewOnlyMovieGrantBackend);
}
