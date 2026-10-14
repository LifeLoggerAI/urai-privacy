import { createHash } from "node:crypto";
import { CONSENT_DECISION_POLICY_VERSION, consentPurposeRegistry } from "../../functions/src/consent-decision";

// Synthetic server-written canonical receipt. Rules tests must not seed partial
// grants: their cleanup deletes records while real revocation triggers are loaded.
export function canonicalConsentFixture(uid = "user-a") {
  const purpose = "ai.personalization";
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const receipt = {
    uid, purpose, consentTier: consentPurposeRegistry[purpose].requiredTier,
    status: "granted", policyVersion: CONSENT_DECISION_POLICY_VERSION,
    expiresAt: "2030-01-01T00:00:00.000Z", surface: "rules-fixture",
    jurisdiction: "synthetic-test", noticeVersion: "synthetic-rules-notice-v1",
    noticeHash: hash({ syntheticNotice: true }), evidenceHash: hash({ syntheticEvidence: true, uid }),
    updatedAt: "2026-10-07T00:00:00.000Z"
  };
  return { ...receipt, receiptHash: hash(receipt) };
}
