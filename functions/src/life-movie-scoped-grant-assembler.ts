import { createHash } from "node:crypto";
import { LIFE_MOVIE_RENDER_CONSENT_PURPOSE, policyVersionForPurpose, type LifeMovieRenderScope } from "./consent-decision";
import { hashLifeMovieScopedReceipt, type LifeMovieScopedReceipt } from "./life-movie-scoped-receipt";

/**
 * SOURCE-ONLY candidate record assembler, NOT an issuer or grant authority.
 *
 * These inputs MUST eventually be read by an independently reviewed owner/
 * notice/tenant/source-rights service from server-owned evidence, followed by
 * a fresh check INSIDE the Firestore grant transaction. Caller-provided claims,
 * selected media digests, approval IDs or status strings are NOT proof.
 *
 * This helper deliberately has no Firebase write, export in functions-entry,
 * callable, HTTP route, credential, feature flag or runtime activation.
 */
export type ReviewedMovieNotice = Readonly<{
  reviewEventId: string;
  noticeVersion: string;
  noticeHash: string;
  policyVersion: string;
  surface: "movie-selection";
  jurisdiction: string;
}>;
export type RecordedOwnerMovieApproval = Readonly<{
  eventId: string;
  actorUid: string;
  ownerUid: string;
  tenantId: string;
  purpose: "life-movie.render";
  status: "granted";
  noticeVersion: string;
  noticeHash: string;
  renderScope: LifeMovieRenderScope;
  approvedAt: string;
  expiresAt: string;
}>;
export type VerifiedMovieSelection = Readonly<{
  eventId: string;
  ownerUid: string;
  tenantId: string;
  renderScope: LifeMovieRenderScope;
  verifiedAt: string;
}>;
export type VerifiedMovieSourceRights = Readonly<{
  rightsEventId: string;
  ownerUid: string;
  tenantId: string;
  renderScope: LifeMovieRenderScope;
  verifiedAt: string;
}>;

export type ScopedGrantAssemblyInput = Readonly<{
  ownerUid: string;
  tenantId: string;
  notice: ReviewedMovieNotice;
  approval: RecordedOwnerMovieApproval;
  selection: VerifiedMovieSelection;
  rights: VerifiedMovieSourceRights;
  nowMs: number;
}>;

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const MAX_EVIDENCE_AGE_MS = 30_000;
const MAX_APPROVAL_AGE_MS = 5 * 60_000;
const MAX_GRANT_TTL_MS = 24 * 60 * 60_000;
const DENIED = "life_movie_scoped_grant_evidence_unverified";

const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
function validScope(value: unknown): value is LifeMovieRenderScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const scope = value as Record<string, unknown>;
  return Reflect.ownKeys(scope).length === 3 &&
    ["projectId", "renderPlanDigest", "sourceSetDigest"].every(key => own(scope, key)) &&
    typeof scope.projectId === "string" && ID.test(scope.projectId) &&
    typeof scope.renderPlanDigest === "string" && SHA256.test(scope.renderPlanDigest) &&
    typeof scope.sourceSetDigest === "string" && SHA256.test(scope.sourceSetDigest);
}
function sameScope(a: unknown, b: LifeMovieRenderScope): boolean {
  return validScope(a) && a.projectId === b.projectId &&
    a.renderPlanDigest === b.renderPlanDigest && a.sourceSetDigest === b.sourceSetDigest;
}
function timestamp(value: unknown): number {
  if (typeof value !== "string" || !ISO.test(value)) throw new Error(DENIED);
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) throw new Error(DENIED);
  return millis;
}
function verifiedFresh(value: string, nowMs: number, maxAgeMs: number): boolean {
  const millis = timestamp(value);
  return millis <= nowMs && millis >= nowMs - maxAgeMs;
}

/** A deterministic and scope-bound proposal; NEVER persist without fresh
 * independent identity, owner selection, consent, source-rights and IAM checks.
 * Hashes are integrity bindings, not signatures or proof of user consent.
 */
export function assembleLifeMovieScopedGrantProposal(
  input: ScopedGrantAssemblyInput
): Readonly<{ record: Readonly<LifeMovieScopedReceipt>; receiptHash: string }> {
  if (!input || !Number.isSafeInteger(input.nowMs) || input.nowMs <= 0 ||
      typeof input.ownerUid !== "string" || !ID.test(input.ownerUid) ||
      typeof input.tenantId !== "string" || !ID.test(input.tenantId)) throw new Error(DENIED);

  const { ownerUid, tenantId, notice, approval, selection, rights, nowMs } = input;
  if (!notice || !approval || !selection || !rights ||
      !validScope(selection.renderScope) ||
      !sameScope(approval.renderScope, selection.renderScope) ||
      !sameScope(rights.renderScope, selection.renderScope) ||
      approval.ownerUid !== ownerUid || approval.actorUid !== ownerUid ||
      selection.ownerUid !== ownerUid || rights.ownerUid !== ownerUid ||
      approval.tenantId !== tenantId || selection.tenantId !== tenantId || rights.tenantId !== tenantId ||
      approval.purpose !== LIFE_MOVIE_RENDER_CONSENT_PURPOSE ||
      approval.status !== "granted" ||
      notice.policyVersion !== policyVersionForPurpose(LIFE_MOVIE_RENDER_CONSENT_PURPOSE) ||
      notice.surface !== "movie-selection" ||
      typeof notice.noticeVersion !== "string" || !SAFE_VERSION.test(notice.noticeVersion) ||
      typeof notice.noticeHash !== "string" || !SHA256.test(notice.noticeHash) ||
      typeof notice.jurisdiction !== "string" || !SAFE_VERSION.test(notice.jurisdiction) ||
      !EVENT_ID.test(notice.reviewEventId) ||
      approval.noticeVersion !== notice.noticeVersion || approval.noticeHash !== notice.noticeHash ||
      !EVENT_ID.test(approval.eventId) || !EVENT_ID.test(selection.eventId) ||
      !EVENT_ID.test(rights.rightsEventId) ||
      !verifiedFresh(approval.approvedAt, nowMs, MAX_APPROVAL_AGE_MS) ||
      !verifiedFresh(selection.verifiedAt, nowMs, MAX_EVIDENCE_AGE_MS) ||
      !verifiedFresh(rights.verifiedAt, nowMs, MAX_EVIDENCE_AGE_MS)) throw new Error(DENIED);
  const expiresMs = timestamp(approval.expiresAt);
  if (expiresMs <= nowMs || expiresMs > nowMs + MAX_GRANT_TTL_MS) throw new Error(DENIED);

  const renderScope = Object.freeze({
    projectId: selection.renderScope.projectId,
    renderPlanDigest: selection.renderScope.renderPlanDigest,
    sourceSetDigest: selection.renderScope.sourceSetDigest
  });
  // Include independently issued event references and their freshness in a
  // synthetic evidence fingerprint; the hash alone never authenticates them.
  const evidenceHash = createHash("sha256").update(JSON.stringify({
    version: "urai-movie-scoped-grant-proposal-v1",
    ownerUid, tenantId,
    approvalEventId: approval.eventId, approvedAt: approval.approvedAt,
    noticeReviewEventId: notice.reviewEventId, noticeVersion: notice.noticeVersion,
    noticeHash: notice.noticeHash,
    selectionEventId: selection.eventId, selectionVerifiedAt: selection.verifiedAt,
    rightsEventId: rights.rightsEventId, rightsVerifiedAt: rights.verifiedAt,
    renderScope, expiresAt: approval.expiresAt
  })).digest("hex");

  const record: Readonly<LifeMovieScopedReceipt> = Object.freeze({
    uid: ownerUid, tenantId,
    purpose: LIFE_MOVIE_RENDER_CONSENT_PURPOSE,
    consentTier: "C6" as const, status: "granted" as const,
    policyVersion: "1.1.0" as const, expiresAt: approval.expiresAt,
    surface: notice.surface, jurisdiction: notice.jurisdiction,
    noticeVersion: notice.noticeVersion, noticeHash: notice.noticeHash,
    evidenceHash, renderScope, updatedAt: new Date(nowMs).toISOString()
  });
  return Object.freeze({ record, receiptHash: hashLifeMovieScopedReceipt(record) });
}
