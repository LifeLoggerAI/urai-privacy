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
 * Create one literal, exact-shape snapshot of authority-bearing Firestore data.
 * No getters, inherited values, symbols, surplus fields or proxy traps can be
 * treated as approval. A snapshot also prevents validation/hash read drift.
 * This validates receipt *integrity*, not the issuer or media rights.
 */
function pinExactOwnData(value: unknown, allowed: readonly string[]): Readonly<Record<string, unknown>> | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== allowed.length ||
        keys.some(key => typeof key !== "string" || !allowed.includes(key))) return null;
    const pinned: Record<string, unknown> = Object.create(null);
    for (const key of allowed) {
      const property = descriptors[key];
      if (!property || !Object.prototype.hasOwnProperty.call(property, "value")) return null;
      pinned[key] = property.value;
    }
    return Object.freeze(pinned);
  } catch {
    return null;
  }
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
  // A hash over selected fields must never silently approve unreviewed fields
  // present on the actual record. Pin both records and exact movie scopes once.
  const root = pinExactOwnData(record, [...fields, "receiptHash"]);
  const request = pinExactOwnData(expected,
    ["subjectUid", "tenantId", "decisionReceiptId", "renderScope"]);
  if (!root || !request) return false;
  const scopeFields = ["projectId", "renderPlanDigest", "sourceSetDigest"] as const;
  const selection = pinExactOwnData(root.renderScope, scopeFields);
  const requested = pinExactOwnData(request.renderScope, scopeFields);
  if (!selection || !requested) return false;
  const source = Object.freeze(Object.assign(Object.create(null) as Record<string, unknown>, root, { renderScope: selection }));

  if (source.uid !== request.subjectUid || source.tenantId !== request.tenantId
    || source.purpose !== "life-movie.render" || source.consentTier !== "C6"
    || source.status !== "granted" || source.policyVersion !== "1.1.0") return false;
  if (typeof source.receiptHash !== "string" || !SHA256_HEX.test(source.receiptHash)
    || source.receiptHash !== request.decisionReceiptId) return false;

  if (typeof selection.projectId !== "string" || !SAFE_PROJECT.test(selection.projectId)
    || typeof selection.renderPlanDigest !== "string" || !SHA256_HEX.test(selection.renderPlanDigest)
    || typeof selection.sourceSetDigest !== "string" || !SHA256_HEX.test(selection.sourceSetDigest)
    || selection.projectId !== requested.projectId
    || selection.renderPlanDigest !== requested.renderPlanDigest
    || selection.sourceSetDigest !== requested.sourceSetDigest) return false;

  for (const key of ["uid", "tenantId", "expiresAt", "surface", "jurisdiction",
    "noticeVersion", "noticeHash", "evidenceHash", "updatedAt"]) {
    if (typeof source[key] !== "string" || !(source[key] as string).length) return false;
  }
  if (!SHA256_HEX.test(source.noticeHash as string)
    || !SHA256_HEX.test(source.evidenceHash as string)) return false;

  return hashLifeMovieScopedReceipt(source as LifeMovieScopedReceipt) === request.decisionReceiptId;
}
