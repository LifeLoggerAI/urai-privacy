export type MemoryIntegrityState =
  | 'canonical'
  | 'inferred'
  | 'lowConfidence'
  | 'disputed'
  | 'quarantined'
  | 'deleted'
  | 'archived'
  | 'excludedFromModel'
  | 'requiresReview';

export type MemoryRiskFlag =
  | 'prompt_injection'
  | 'spoofed_location'
  | 'unverified_audio'
  | 'relationship_accusation'
  | 'health_adjacent'
  | 'bystander_privacy'
  | 'coerced_access'
  | 'model_contamination';

export interface MemoryIntegrityInput {
  confidence: 'sample' | 'low' | 'medium' | 'high' | 'verified';
  riskFlags: MemoryRiskFlag[];
  userDisputed?: boolean;
  userDeleted?: boolean;
  excludeFromModel?: boolean;
}

export interface MemoryIntegrityDecision {
  state: MemoryIntegrityState;
  canMutateCanonicalMemory: boolean;
  canEnterModelContext: boolean;
  userFacingLabel: string;
  requiredControls: string[];
}

export function decideMemoryIntegrityState(input: MemoryIntegrityInput): MemoryIntegrityDecision {
  if (input.userDeleted) {
    return decision('deleted', false, false, 'Deleted by user', ['export_audit', 'respect_retention_policy']);
  }

  if (input.excludeFromModel) {
    return decision('excludedFromModel', true, false, 'Excluded from model context', ['restore_control', 'audit_log']);
  }

  if (input.userDisputed) {
    return decision('disputed', false, false, 'Disputed memory', ['correct', 'delete', 'request_review', 'export']);
  }

  if (input.riskFlags.length > 0) {
    return decision('quarantined', false, false, 'Quarantined for review', ['correct', 'delete', 'request_review', 'audit_log']);
  }

  if (input.confidence === 'low' || input.confidence === 'sample') {
    return decision('lowConfidence', false, false, 'Low confidence memory', ['confirm', 'correct', 'delete']);
  }

  if (input.confidence === 'medium') {
    return decision('inferred', false, true, 'Inferred memory', ['confirm', 'correct', 'delete', 'exclude_from_model']);
  }

  return decision('canonical', true, true, 'Confirmed memory', ['correct', 'delete', 'export', 'exclude_from_model']);
}

function decision(
  state: MemoryIntegrityState,
  canMutateCanonicalMemory: boolean,
  canEnterModelContext: boolean,
  userFacingLabel: string,
  requiredControls: string[],
): MemoryIntegrityDecision {
  return { state, canMutateCanonicalMemory, canEnterModelContext, userFacingLabel, requiredControls };
}
