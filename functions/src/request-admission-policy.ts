/**
 * Source-only, fail-closed admission for the public Privacy request callables.
 * This check supplements (never replaces) current signed Auth revalidation,
 * current C7 consent evaluation, and downstream processing authorization.
 */
export type RequestAdmissionInput = Readonly<{
  uid: string;
  deletionState: boolean | undefined;
  tombstone: unknown;
}>;

export type ExportRequestAdmissionInput = RequestAdmissionInput & Readonly<{
  consent: unknown;
  canonicalConsentAllowed: boolean;
  consentExpiresAtMillis: number;
  projectedExpiresAtMillis: number;
  nowMillis: number;
}>;

function ownData(record: unknown, key: string): unknown {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
  try {
    const field = Object.getOwnPropertyDescriptor(record, key);
    return field && Object.hasOwn(field, 'value') ? field.value : undefined;
  } catch {
    return undefined;
  }
}

export function deletionRequestAdmissionBlockReason(input: RequestAdmissionInput): string | null {
  const { uid, deletionState, tombstone } = input;
  if (typeof uid !== 'string' || !uid.trim() || uid.includes('/') || uid === '.' || uid === '..') {
    return 'invalid_subject';
  }
  // A missing tombstone is a verified absence and must NOT prevent the owner
  // exercising deletion rights. A present document requires an exact subject.
  if (deletionState !== false) return 'subject_deletion_or_planning_fenced';
  if (tombstone == null) return null;
  if (ownData(tombstone, 'uid') !== uid || ownData(tombstone, 'active') !== false) {
    return 'malformed_or_foreign_deletion_fence';
  }
  return null;
}

export function exportRequestAdmissionBlockReason(input: ExportRequestAdmissionInput): string | null {
  const base = deletionRequestAdmissionBlockReason(input);
  if (base) return base;
  const { uid, consent, tombstone, canonicalConsentAllowed, consentExpiresAtMillis,
    projectedExpiresAtMillis, nowMillis } = input;
  // Export is a consent-governed operation; unlike deletion, no missing
  // tombstone or merely pending opt-in may create a processing job.
  if (tombstone == null) return 'missing_c7_projection';
  if (canonicalConsentAllowed !== true) return 'canonical_c7_not_current';
  if (ownData(consent, 'uid') !== uid || ownData(consent, 'purpose') !== 'data.export'
    || ownData(consent, 'consentTier') !== 'C7' || ownData(consent, 'status') !== 'granted'
    || ownData(consent, 'policyVersion') !== '1.0.0') {
    return 'canonical_c7_subject_or_policy_mismatch';
  }
  const receipt = ownData(consent, 'receiptHash');
  if (typeof receipt !== 'string' || !/^[0-9a-f]{64}$/.test(receipt)
    || ownData(tombstone, 'exportConsentStatus') !== 'granted'
    || ownData(tombstone, 'exportConsentReceiptHash') !== receipt
    || ownData(tombstone, 'exportConsentPolicyVersion') !== '1.0.0') {
    return 'c7_receipt_projection_mismatch';
  }
  if (!Number.isSafeInteger(nowMillis) || !Number.isSafeInteger(consentExpiresAtMillis)
    || !Number.isSafeInteger(projectedExpiresAtMillis)
    || consentExpiresAtMillis <= nowMillis || projectedExpiresAtMillis !== consentExpiresAtMillis) {
    return 'c7_expired_or_projection_expiry_mismatch';
  }
  return null;
}

/** Only a fresh request or an explicitly expired, matching processing lease may be claimed. */
export function exportProcessingRequestStateBlockReason(args: {
  requestStatus: unknown;
  jobStatus: unknown;
  priorProcessingLeaseActive: boolean;
}): string | null {
  if (!args || typeof args !== 'object') return 'EXPORT_REQUEST_STATE_MISMATCH';
  if ((args.requestStatus === 'pending' || args.requestStatus === 'approved')
    && (args.jobStatus === 'pending' || args.jobStatus === 'failed')) return null;
  if (args.requestStatus === 'processing' && args.jobStatus === 'processing'
    && args.priorProcessingLeaseActive === false) return null;
  return 'EXPORT_REQUEST_STATE_MISMATCH';
}
