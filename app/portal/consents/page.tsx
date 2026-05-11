
'use client';

import ConsentManager from '@/components/ConsentManager';
import AuditLogViewer from '@/components/AuditLogViewer';
import { useAuth } from '@/firebase/AuthContext';

export default function ConsentsPage() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your Privacy Controls</h1>
      
      {user ? (
        <div className="space-y-12">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Consent Management</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">Manage your data and privacy settings. Your choices will be recorded and respected.</p>
            <ConsentManager />
          </div>
          
          <div>
            <h2 className="text-2xl font-semibold mb-4">Activity Log</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">Review a log of all privacy-related actions on your account.</p>
            <AuditLogViewer />
          </div>
        </div>
      ) : (
        <p>Please log in to manage your privacy settings.</p>
      )}
    </div>
  );
}
