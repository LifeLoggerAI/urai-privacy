import { describe, expect, it } from 'vitest';
import { privacyHealthReport, createExportRequest, createDeletionRequest, updateConsentPreference } from '../../src/lib/privacy-workflows';

const owner = { uid: 'integration-owner', role: 'owner' as const };
const admin = { uid: 'integration-admin', role: 'admin' as const };

describe('privacy integration smoke coverage', () => {
  it('connects owner export, deletion, consent, and health workflows', () => {
    const exportResult = createExportRequest({ actor: owner, ownerUid: owner.uid, requestId: 'export-int-1' });
    expect(exportResult.request.ownerUid).toBe(owner.uid);
    expect(exportResult.job.type).toBe('export');
    expect(exportResult.auditEvent.action).toBe('privacy.export.requested');

    const deletionResult = createDeletionRequest({ actor: owner, ownerUid: owner.uid, requestId: 'delete-int-1' });
    expect(deletionResult.request.ownerUid).toBe(owner.uid);
    expect(deletionResult.job.type).toBe('deletion');
    expect(deletionResult.retentionDeclaration.deletedData.length).toBeGreaterThan(0);

    const consentResult = updateConsentPreference({ actor: owner, ownerUid: owner.uid, category: 'analytics', enabled: false });
    expect(consentResult.preference.enabled).toBe(false);
    expect(consentResult.auditEvent.action).toBe('privacy.consent.updated');

    const health = privacyHealthReport({
      openRequests: [exportResult.request, deletionResult.request],
      staleAuditLogCount: 0,
      missingRetentionDeclarations: 0
    });
    expect(health.status).toBe('attention');
    expect(health.openRequestCount).toBe(2);
  });

  it('keeps admin-only state transitions explicit', () => {
    const exportResult = createExportRequest({ actor: owner, ownerUid: owner.uid, requestId: 'export-int-2' });
    expect(() => createExportRequest({ actor: admin, ownerUid: owner.uid, requestId: 'export-int-3' })).not.toThrow();
    expect(exportResult.request.status).toBe('pending');
  });
});
