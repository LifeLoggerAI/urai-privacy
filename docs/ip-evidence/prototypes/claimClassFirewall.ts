export type ClaimClass =
  | 'vision'
  | 'synthetic_demo'
  | 'source_ready'
  | 'private_prototype'
  | 'provider_active'
  | 'device_certified'
  | 'production_live'
  | 'filed_or_registered'
  | 'prohibited';

export type PrivacyClass =
  | 'public_copy'
  | 'account_data'
  | 'sensitive_inference'
  | 'biometric_or_likeness'
  | 'child_or_family'
  | 'communications'
  | 'location'
  | 'health_adjacent'
  | 'monetization_or_sharing';

export type EvidenceType =
  | 'source_commit'
  | 'privacy_review'
  | 'consent_tier'
  | 'retention_delete_export'
  | 'audit_log'
  | 'provider_receipt'
  | 'device_proof'
  | 'deployment_receipt'
  | 'live_smoke'
  | 'rollback_proof'
  | 'official_legal_receipt';

export interface ClaimReviewInput {
  claimText: string;
  claimClass: ClaimClass;
  privacyClasses: PrivacyClass[];
  availableEvidence: EvidenceType[];
}

export interface ClaimReviewResult {
  allowed: boolean;
  allowedCopy: string;
  blockedReason?: string;
  requiredEvidence: EvidenceType[];
  userFacingLabel: string;
}

const BASE_REQUIRED_EVIDENCE: Record<ClaimClass, EvidenceType[]> = {
  vision: [],
  synthetic_demo: ['source_commit'],
  source_ready: ['source_commit'],
  private_prototype: ['source_commit', 'privacy_review'],
  provider_active: ['source_commit', 'privacy_review', 'provider_receipt'],
  device_certified: ['source_commit', 'privacy_review', 'device_proof'],
  production_live: ['source_commit', 'privacy_review', 'deployment_receipt', 'live_smoke', 'rollback_proof'],
  filed_or_registered: ['official_legal_receipt'],
  prohibited: [],
};

const PRIVACY_REQUIRED_EVIDENCE: Partial<Record<PrivacyClass, EvidenceType[]>> = {
  sensitive_inference: ['consent_tier', 'privacy_review', 'retention_delete_export', 'audit_log'],
  biometric_or_likeness: ['consent_tier', 'privacy_review', 'retention_delete_export', 'audit_log'],
  child_or_family: ['consent_tier', 'privacy_review', 'retention_delete_export', 'audit_log'],
  communications: ['consent_tier', 'privacy_review', 'retention_delete_export', 'audit_log'],
  location: ['consent_tier', 'privacy_review', 'retention_delete_export', 'audit_log'],
  health_adjacent: ['consent_tier', 'privacy_review', 'retention_delete_export', 'audit_log'],
  monetization_or_sharing: ['consent_tier', 'privacy_review', 'retention_delete_export', 'audit_log'],
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function missingEvidence(required: EvidenceType[], available: EvidenceType[]): EvidenceType[] {
  const availableSet = new Set(available);
  return required.filter((item) => !availableSet.has(item));
}

export function reviewUraiClaim(input: ClaimReviewInput): ClaimReviewResult {
  if (input.claimClass === 'prohibited') {
    return {
      allowed: false,
      allowedCopy: 'This capability is not available for public claim.',
      blockedReason: 'Claim class is prohibited under the current evidence boundary.',
      requiredEvidence: [],
      userFacingLabel: 'Not available',
    };
  }

  const requiredEvidence = unique([
    ...BASE_REQUIRED_EVIDENCE[input.claimClass],
    ...input.privacyClasses.flatMap((privacyClass) => PRIVACY_REQUIRED_EVIDENCE[privacyClass] ?? []),
  ]);

  const missing = missingEvidence(requiredEvidence, input.availableEvidence);

  if (missing.length > 0) {
    return {
      allowed: false,
      allowedCopy: downgradeClaim(input.claimText, input.claimClass),
      blockedReason: `Missing evidence: ${missing.join(', ')}`,
      requiredEvidence,
      userFacingLabel: 'Evidence-gated',
    };
  }

  return {
    allowed: true,
    allowedCopy: input.claimText,
    requiredEvidence,
    userFacingLabel: labelForClaimClass(input.claimClass),
  };
}

function downgradeClaim(claimText: string, claimClass: ClaimClass): string {
  if (claimClass === 'filed_or_registered') {
    return 'IP status requires official legal receipt before public use.';
  }
  if (claimClass === 'production_live' || claimClass === 'provider_active' || claimClass === 'device_certified') {
    return claimText.replace(/is|are|does|can/i, 'is planned as').replace(/live|active|certified/gi, 'evidence-gated');
  }
  return `Evidence-gated: ${claimText}`;
}

function labelForClaimClass(claimClass: ClaimClass): string {
  switch (claimClass) {
    case 'vision':
      return 'Vision / roadmap';
    case 'synthetic_demo':
      return 'Synthetic demo';
    case 'source_ready':
      return 'Source-ready';
    case 'private_prototype':
      return 'Private prototype';
    case 'provider_active':
      return 'Provider-active with receipt';
    case 'device_certified':
      return 'Device-certified with proof';
    case 'production_live':
      return 'Production-live with receipts';
    case 'filed_or_registered':
      return 'Official legal receipt required';
    case 'prohibited':
      return 'Not available';
  }
}
