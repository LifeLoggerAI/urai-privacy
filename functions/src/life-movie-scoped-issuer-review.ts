import { randomUUID } from "node:crypto";
import { assembleLifeMovieScopedGrantProposal } from "./life-movie-scoped-grant-assembler";
import { checkedLifeMovieDeletionState, type LifeMovieDeletionTombstoneSnapshot } from "./life-movie-deletion-fence";
import { evaluateLifeMovieRenderAuthorization } from "./life-movie-render-authorization";
import type { ReviewedMovieNotice, RecordedOwnerMovieApproval, VerifiedMovieSelection, VerifiedMovieSourceRights } from "./life-movie-scoped-grant-assembler";

/**
 * REVIEW-ONLY, NOT A DEPLOYABLE ISSUER.
 *
 * This is the transaction-side integration seam, not an approved authentication
 * or source-rights service. It is NOT exported from functions-entry, called by
 * a Firebase callable, installed in Jobs, or authorized to issue real consent.
 *
 * A future reviewed server adapter MUST authenticate and checkRevoked the owner,
 * derive each source from protected independently reviewed evidence, implement
 * all reads/writes inside ONE Firestore transaction, and enforce IAM. A test
 * adapter is not evidence of production owner approval or legal source rights.
 */
export type ReviewOnlyMovieGrantRequest = Readonly<{
  ownerUid: string;
  tenantId: string;
  noticeReviewEventId: string;
  approvalEventId: string;
  selectionEventId: string;
  rightsEventId: string;
}>;

export type ReviewOnlyMovieGrantTransaction = Readonly<{
  /** Server-owned profile, NOT caller profile metadata. */
  readOwnerProfile: (ownerUid: string) => Promise<unknown>;
  /** Snapshot read within the same transaction; null/unknown MUST deny. */
  readDeletionTombstone: (ownerUid: string) => Promise<LifeMovieDeletionTombstoneSnapshot | null>;
  /** An existing denial, revocation or grant MUST NOT be silently overwritten. */
  readExistingGrant: (recordId: string) => Promise<unknown>;
  readReviewedNotice: (eventId: string) => Promise<unknown>;
  readOwnerApproval: (eventId: string) => Promise<unknown>;
  readVerifiedSelection: (eventId: string) => Promise<unknown>;
  readVerifiedSourceRights: (eventId: string) => Promise<unknown>;
  /** Both writes MUST be scheduled into the same atomic transaction. */
  createGrant: (recordId: string, record: Readonly<Record<string, unknown>>) => void;
  createAudit: (eventId: string, audit: Readonly<Record<string, unknown>>) => void;
}>;

export type ReviewOnlyMovieGrantBackend = Readonly<{
  /** Trusted Firebase owner identity, not a UID supplied by Studio or Jobs. */
  verifiedActiveOwnerUid: () => Promise<string>;
  /** Must retry on Firestore read conflicts and roll back BOTH writes on failure. */
  runTransaction: <T>(fn: (tx: ReviewOnlyMovieGrantTransaction) => Promise<T>) => Promise<T>;
  nowMs: () => number;
}>;

const DENIED = "life_movie_review_only_issuer_evidence_unverified";
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function ownLiteral(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(DENIED);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new Error(DENIED);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) throw new Error(DENIED);
  return descriptor.value;
}

function verifiedRequest(value: unknown): ReviewOnlyMovieGrantRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(DENIED);
  const fields = ["ownerUid", "tenantId", "noticeReviewEventId", "approvalEventId", "selectionEventId", "rightsEventId"];
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length ||
      keys.some((key) => typeof key !== "string" || !fields.includes(key))) throw new Error(DENIED);
  const pinned = Object.create(null) as Record<string, string>;
  for (const field of fields) {
    const val = ownLiteral(value, field);
    const pattern = field === "ownerUid" || field === "tenantId" ? IDENTIFIER : EVENT_ID;
    if (typeof val !== "string" || !pattern.test(val)) throw new Error(DENIED);
    pinned[field] = val;
  }
  return Object.freeze(pinned) as unknown as ReviewOnlyMovieGrantRequest;
}

/**
 * Optional legacy profile flags are clear only when absent or literal false.
 * An inherited/accessor-backed, malformed or active lifecycle flag is never
 * permission to issue even a synthetic review-only scoped C6 record.
 */
function optionalOwnerLifecycleFenceClear(record: unknown, key: "disabled" | "dataRightsDeletionPendingCentralPrivacy"): boolean {
  try {
    if (!record || typeof record !== "object" || Array.isArray(record)) return false;
    return !Reflect.has(record, key) || ownLiteral(record, key) === false;
  } catch {
    return false;
  }
}

function currentOwnerProfile(record: unknown, ownerUid: string, tenantId: string): boolean {
  try {
    return ownLiteral(record, "uid") === ownerUid &&
      ownLiteral(record, "tenantId") === tenantId &&
      ownLiteral(record, "accountStatus") === "active" &&
      ownLiteral(record, "deleted") === false &&
      ownLiteral(record, "markedForDeletion") === false &&
      optionalOwnerLifecycleFenceClear(record, "disabled") &&
      optionalOwnerLifecycleFenceClear(record, "dataRightsDeletionPendingCentralPrivacy");
  } catch {
    return false;
  }
}

function matchesEvent(record: unknown, field: string, eventId: string): boolean {
  try { return ownLiteral(record, field) === eventId; }
  catch { return false; }
}

/**
 * Review-only candidate proof: real transaction implementation must re-read
 * current owner, deletion fence, notice, recorded owner approval, selection,
 * rights and existing consent BEFORE any writes. No unscoped C6 consent is
 * issued, no producer/worker is activated, and no deployment path imports it.
 *
 * Do NOT wire this into a callable without independent security/legal review
 * and a trusted server-owned source/ownership evidence adapter.
 */
export async function writeReviewOnlyScopedGrantCandidate(
  untrustedRequest: unknown,
  backend: ReviewOnlyMovieGrantBackend,
): Promise<Readonly<{ recordId: string; receiptHash: string; auditEventId: string }>> {
  try {
    const request = verifiedRequest(untrustedRequest);
    if (!backend || typeof backend.verifiedActiveOwnerUid !== "function" ||
        typeof backend.runTransaction !== "function" || typeof backend.nowMs !== "function") {
      throw new Error(DENIED);
    }
    return await backend.runTransaction(async (tx) => {
      if (!tx || typeof tx.readOwnerProfile !== "function" ||
          typeof tx.readDeletionTombstone !== "function" ||
          typeof tx.readExistingGrant !== "function" ||
          typeof tx.readReviewedNotice !== "function" ||
          typeof tx.readOwnerApproval !== "function" ||
          typeof tx.readVerifiedSelection !== "function" ||
          typeof tx.readVerifiedSourceRights !== "function" ||
          typeof tx.createGrant !== "function" || typeof tx.createAudit !== "function") {
        throw new Error(DENIED);
      }
      // Identity must originate from verified, active Firebase owner auth,
      // rather than the request or a Studio-supplied role/UID.
      const actorUid = await backend.verifiedActiveOwnerUid();
      if (actorUid !== request.ownerUid) throw new Error(DENIED);
      const nowMs = backend.nowMs();
      if (!Number.isSafeInteger(nowMs) || nowMs <= 0) throw new Error(DENIED);

      const recordId = request.ownerUid + "_life-movie_render";
      const [profile, tombstone, existing, notice, approval, selection, rights] = await Promise.all([
        tx.readOwnerProfile(request.ownerUid),
        tx.readDeletionTombstone(request.ownerUid),
        tx.readExistingGrant(recordId),
        tx.readReviewedNotice(request.noticeReviewEventId),
        tx.readOwnerApproval(request.approvalEventId),
        tx.readVerifiedSelection(request.selectionEventId),
        tx.readVerifiedSourceRights(request.rightsEventId),
      ]);
      if (!currentOwnerProfile(profile, request.ownerUid, request.tenantId) ||
          checkedLifeMovieDeletionState(tombstone) !== false ||
          existing !== null ||
          !matchesEvent(notice, "reviewEventId", request.noticeReviewEventId) ||
          !matchesEvent(approval, "eventId", request.approvalEventId) ||
          !matchesEvent(selection, "eventId", request.selectionEventId) ||
          !matchesEvent(rights, "rightsEventId", request.rightsEventId)) throw new Error(DENIED);

      // The proposal helper re-pins EVERY nested own-data field and checks
      // active matching owner, reviewed notice, tenant, scope and evidence age.
      const proposal = assembleLifeMovieScopedGrantProposal({
        ownerUid: request.ownerUid,
        tenantId: request.tenantId,
        notice: notice as ReviewedMovieNotice,
        approval: approval as RecordedOwnerMovieApproval,
        selection: selection as VerifiedMovieSelection,
        rights: rights as VerifiedMovieSourceRights,
        nowMs,
      });
      const grant = Object.freeze({ ...proposal.record, receiptHash: proposal.receiptHash });
      const policy = evaluateLifeMovieRenderAuthorization({
        record: grant,
        deletionActive: false,
        subjectUid: request.ownerUid,
        tenantId: request.tenantId,
        decisionReceiptId: proposal.receiptHash,
        policyVersion: "1.1.0",
        renderScope: proposal.record.renderScope,
        now: new Date(nowMs),
      });
      if (!policy.allowed) throw new Error(DENIED);

      const auditEventId = randomUUID();
      tx.createGrant(recordId, grant);
      tx.createAudit(auditEventId, Object.freeze({
        schemaVersion: "urai-review-only-life-movie-grant-v1",
        action: "review_only_scoped_grant_candidate",
        ownerUid: request.ownerUid, tenantId: request.tenantId,
        receiptHash: proposal.receiptHash,
        noticeReviewEventId: request.noticeReviewEventId,
        approvalEventId: request.approvalEventId,
        selectionEventId: request.selectionEventId,
        rightsEventId: request.rightsEventId,
        recordedAt: new Date(nowMs).toISOString(),
        productionAuthorized: false,
        issuerApproved: false,
      }));
      return Object.freeze({ recordId, receiptHash: proposal.receiptHash, auditEventId });
    });
  } catch {
    throw new Error(DENIED);
  }
}
