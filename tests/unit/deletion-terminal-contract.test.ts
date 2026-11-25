import { expect, test } from 'vitest';
import { terminalDigest, verifyTerminalReceipt, type TerminalBinding } from '../../functions/src/deletion-terminal-contract';
const binding: TerminalBinding = { participantId: 'urai-spatial', centralRequestId: 'central-request', sourceRequestId: 'source-request', sourceProject: 'source-project', serviceUid: 'service-identity', sourceRevision: 'a'.repeat(40), ownerHash: 'b'.repeat(64), planHash: 'c'.repeat(64), sourceReceiptPath: 'deletionParticipantReceipts/source-request', authorizedAtMillis: 200 };
function receipt() {
  const { sourceReceiptPath, authorizedAtMillis, ...fields } = binding;
  const result = { verifiedZeroScan: true, scannedTargets: 0, retainedExceptions: [] };
  return { ...fields, schemaVersion: 'urai-deletion-participant-terminal-v1', disposition: 'no-subject-data', completedAtMillis: 300, residualCount: 0, unresolvedDomains: [], result, resultDigest: terminalDigest(result) };
}
test('full receipt hash rejects wrong authority', () => {
  const r = receipt(); expect(verifyTerminalReceipt(r, binding, 100, 400)).toBe(terminalDigest(r));
  for (const key of ['ownerHash','sourceProject','serviceUid','sourceRevision','planHash','centralRequestId','sourceRequestId'])
    expect(verifyTerminalReceipt({ ...r, [key]: 'wrong' }, binding, 100, 400)).toBeNull();
});
test('rejects stale/future receipts and unknown fields', () => {
  for (const time of [100, 401, NaN]) expect(verifyTerminalReceipt({ ...receipt(), completedAtMillis: time }, binding, 100, 400)).toBeNull();
  expect(verifyTerminalReceipt({ ...receipt(), ignored: 'field' }, binding, 100, 400)).toBeNull();
});
test('zero marker cannot bypass unresolved, retention or digest checks', () => {
  expect(verifyTerminalReceipt({ ...receipt(), unresolvedDomains: ['provider'] }, binding, 100, 400)).toBeNull();
  for (const result of [{ verifiedZeroScan: false, scannedTargets: 0, retainedExceptions: [] }, { verifiedZeroScan: true, scannedTargets: 0, retainedExceptions: ['legal'] }, { verifiedZeroScan: true, scannedTargets: 1, retainedExceptions: [] }])
    expect(verifyTerminalReceipt({ ...receipt(), result, resultDigest: terminalDigest(result) }, binding, 100, 400)).toBeNull();
});
