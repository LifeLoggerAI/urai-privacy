import { createHash } from 'node:crypto';

const hex64 = /^[a-f0-9]{64}$/;
const safeId = /^[A-Za-z0-9._:-]{8,160}$/;
const sha256 = (x: string) => createHash('sha256').update(x).digest('hex');
export type JobsDeleteEvidence = {
  schemaVersion: 'urai-jobs-data-rights-execution-v1';
  event: 'DATA_RIGHTS_EXECUTION_FINISHED';
  requestId: string;
  requestType: 'DELETE';
  ownerHash: string;
  resultDigest: string;
  terminalState: 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED';
  result: Record<string, unknown>;
};

export function verifyJobsDeleteEvidence(value: unknown, ownerUid: string, jobsRequestId: string): JobsDeleteEvidence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    !safeId.test(ownerUid) || !safeId.test(jobsRequestId)) return null;
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== 'urai-jobs-data-rights-execution-v1' ||
      row.event !== 'DATA_RIGHTS_EXECUTION_FINISHED' ||
      row.requestId !== jobsRequestId || row.requestType !== 'DELETE' ||
      row.ownerHash !== sha256(ownerUid) ||
      row.terminalState !== 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED' ||
      typeof row.resultDigest !== 'string' || !hex64.test(row.resultDigest) ||
      !row.result || typeof row.result !== 'object' || Array.isArray(row.result)) return null;
  const result = row.result as Record<string, unknown>;
  if (!['jobsAnonymized','queueDeletes','jobResultDeletes','logDeletes'].every(k =>
    Number.isSafeInteger(result[k]) && (result[k] as number) >= 0) ||
    !Array.isArray(result.unresolvedDomains) ||
    !result.unresolvedDomains.includes('cross-system-data-owned-by-other-urai-services') ||
    !result.unresolvedDomains.includes('orphan-job-results-without-parent-job') ||
    result.unresolvedDomains.some(x => typeof x !== 'string' || x.length > 160)) return null;
  if (sha256(JSON.stringify(result)) !== row.resultDigest) return null;
  return row as JobsDeleteEvidence;
}
export function jobsDeleteEvidenceHash(evidence: JobsDeleteEvidence): string {
  return sha256(JSON.stringify({
    schemaVersion: evidence.schemaVersion,
    event: evidence.event,
    requestId: evidence.requestId,
    requestType: evidence.requestType,
    ownerHash: evidence.ownerHash,
    resultDigest: evidence.resultDigest,
    terminalState: evidence.terminalState,
  }));
}
