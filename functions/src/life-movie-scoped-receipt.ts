import { createHash } from "node:crypto";

/**
 * Versioned *integrity* binding for a consent receipt to a specific movie,
 * immutable selected sources, tenant, policy, and the user-visible notice.
 *
 * A SHA-256 receipt hash is NOT a cryptographic signature or authority:
 * only a protected, reviewed server-side issuer may write this record.
 */
export type LifeMovieScopedReceipt = Readonly<{
  uid: string;
  tenantId: string;
  purpose: "life-movie.render";
  consentTier: "C6";
  status: "granted";
  policyVersion: "1.1.0";
  expiresAt: string;
  surface: string;
  jurisdiction: string;
  noticeVersion: string;
  noticeHash: string;
  evidenceHash: string;
  renderScope: Readonly<{
    projectId: string;
    renderPlanDigest: string;
    sourceSetDigest: string;
  }>;
  updatedAt: string;
}>;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SAFE_PROJECT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const fields = [
  "uid", "tenantId", "purpose", "consentTier", "status", "policyVersion",
  "expiresAt", "surface", "jurisdiction", "noticeVersion", "noticeHash",
  "evidenceHash", "renderScope", "updatedAt"
] as const;

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Construct the canonical payload with exactly the approved field order.
 * Future scoped issuance must use this same helper before writing a grant.
 */
export function hashLifeMovieScopedReceipt(receipt: LifeMovieScopedReceipt): string {
  const payload = {
    uid: receipt.uid,
    tenantId: receipt.tenantId,
    purpose: receipt.purpose,
    consentTier: receipt.consentTier,
    status: receipt.status,
    policyVersion: receipt.policyVersion,
    expiresAt: receipt.expiresAt,
    surface: receipt.surface,
    jurisdiction: receipt.jurisdiction,
    noticeVersion: receipt.noticeVersion,
    noticeHash: receipt.noticeHash,
    evidenceHash: receipt.evidenceHash,
    renderScope: {
      projectId: receipt.renderScope.projectId,
      renderPlanDigest: receipt.renderScope.renderPlanDigest,
      sourceSetDigest: receipt.renderScope.sourceSetDigest
    },
    updatedAt: receipt.updatedAt
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Rejects broad legacy receipts, forged loose renderScope fields, stale
 * tenant/movie/source binding and records missing the issued scope.
 * Independent token identity, Firestore IAM and source rights are still required.
 */
export function verifiesLifeMovieScopedReceipt(
  record: unknown,
  expected: {
    subjectUid: string;
    tenantId: string;
    decisionReceiptId: string;
    renderScope: LifeMovieScopedReceipt["renderScope"];
  }
): boolean {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const source = record as Record<string, unknown>;
  if (!fields.every((key) => hasOwn(source, key))) return false;
  if (source.uid !== expected.subjectUid || source.tenantId !== expected.tenantId
    || source.purpose !== "life-movie.render" || source.consentTier !== "C6"
    || source.status !== "granted" || source.policyVersion !== "1.1.0") return false;
  if (typeof source.receiptHash !== "string" || !SHA256_HEX.test(source.receiptHash)
    || source.receiptHash !== expected.decisionReceiptId) return false;

  const scope = source.renderScope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  const selection = scope as Record<string, unknown>;
  if (Object.keys(selection).length !== 3
    || !["projectId", "renderPlanDigest", "sourceSetDigest"].every((key) => hasOwn(selection, key))
    || typeof selection.projectId !== "string" || !SAFE_PROJECT.test(selection.projectId)
    || typeof selection.renderPlanDigest !== "string" || !SHA256_HEX.test(selection.renderPlanDigest)
    || typeof selection.sourceSetDigest !== "string" || !SHA256_HEX.test(selection.sourceSetDigest)
    || selection.projectId !== expected.renderScope.projectId
    || selection.renderPlanDigest !== expected.renderScope.renderPlanDigest
    || selection.sourceSetDigest !== expected.renderScope.sourceSetDigest) return false;

  for (const key of ["uid", "tenantId", "expiresAt", "surface", "jurisdiction",
    "noticeVersion", "noticeHash", "evidenceHash", "updatedAt"]) {
    if (typeof source[key] !== "string" || !(source[key] as string).length) return false;
  }
  if (!SHA256_HEX.test(source.noticeHash as string)
    || !SHA256_HEX.test(source.evidenceHash as string)) return false;

  const receipt = source as unknown as LifeMovieScopedReceipt;
  return hashLifeMovieScopedReceipt(receipt) === expected.decisionReceiptId;
}
