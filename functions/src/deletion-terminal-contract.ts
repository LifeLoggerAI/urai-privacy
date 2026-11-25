import { createHash } from 'node:crypto';

export const TERMINAL_RECEIPT_VERSION = 'urai-deletion-participant-terminal-v1';
export type TerminalBinding = {
  participantId: string; centralRequestId: string; sourceRequestId: string;
  sourceProject: string; serviceUid: string; sourceRevision: string; ownerHash: string; planHash: string;
  sourceReceiptPath: string; authorizedAtMillis: number;
};
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}
export const terminalDigest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const terminalOwnerHash = (uid: string): string => createHash('sha256').update(uid).digest('hex');

/** Only called on an independently fetched source document, never caller data. */
export function verifyTerminalReceipt(value: unknown, binding: TerminalBinding, requestCreatedAt: number, now: number): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const keys = ['schemaVersion','participantId','centralRequestId','sourceRequestId','sourceProject','serviceUid',
    'sourceRevision','ownerHash','planHash','disposition','completedAtMillis','residualCount','unresolvedDomains','resultDigest','result'];
  if (Object.keys(row).length !== keys.length || keys.some(key => !(key in row))) return null;
  if (row.schemaVersion !== TERMINAL_RECEIPT_VERSION ||
      ['participantId','centralRequestId','sourceRequestId','sourceProject','serviceUid','sourceRevision','ownerHash','planHash']
        .some(key => row[key] !== binding[key as keyof TerminalBinding]) ||
      !/^[a-f0-9]{40}$/.test(binding.sourceRevision) ||
      !/^[a-f0-9]{64}$/.test(binding.ownerHash) || !/^[a-f0-9]{64}$/.test(binding.planHash) ||
      !Number.isSafeInteger(requestCreatedAt) || !Number.isSafeInteger(binding.authorizedAtMillis) ||
      !Number.isSafeInteger(now) || !Number.isSafeInteger(row.completedAtMillis) ||
      (row.completedAtMillis as number) < Math.max(requestCreatedAt, binding.authorizedAtMillis) ||
      (row.completedAtMillis as number) > now || row.residualCount !== 0 ||
      !Array.isArray(row.unresolvedDomains) || row.unresolvedDomains.length !== 0 ||
      !['deleted','no-subject-data'].includes(String(row.disposition)) ||
      !row.result || typeof row.result !== 'object' || Array.isArray(row.result)) return null;
  const result = row.result as Record<string, unknown>;
  if (Object.keys(result).length !== 3 || result.verifiedZeroScan !== true || !Number.isSafeInteger(result.scannedTargets) ||
      (result.scannedTargets as number) < 0 || !Array.isArray(result.retainedExceptions) ||
      result.retainedExceptions.length !== 0 ||
      (row.disposition === 'no-subject-data' && result.scannedTargets !== 0) ||
      row.resultDigest !== terminalDigest(result)) return null;
  return terminalDigest(row);
}
