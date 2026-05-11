import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/firebase';

export type AuditAction =
  | 'consent_change'
  | 'policy_acknowledgement'
  | 'data_export_requested'
  | 'account_deletion_requested';

const logAuditEventFn = httpsCallable<
  { action: AuditAction; details: Record<string, unknown> },
  { success: boolean }
>(functions, 'logAuditEvent');

export const logAuditEvent = async (
  action: AuditAction,
  details: Record<string, unknown> = {}
): Promise<void> => {
  try {
    await logAuditEventFn({ action, details });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};