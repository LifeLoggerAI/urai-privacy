
'use client';

import ConsentManager from '@/components/ConsentManager';
import ExportManager from '@/components/ExportManager';
import DeletionManager from '@/components/DeletionManager';
import AuditLogViewer from '@/components/AuditLogViewer';
import { useAuth } from '@/firebase/AuthContext'; // Mocked auth context for now

export default function PrivacyDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please sign in to view your privacy dashboard.</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Privacy Dashboard</h1>

      <section>
        <h2 className="text-2xl font-semibold">Consent Management</h2>
        <p className="text-gray-600 mb-4">Control how your data is used across our services.</p>
        <ConsentManager />
      </section>

      <section>
        <h2 className="text-2xl font-semibold">Data Export</h2>
        <p className="text-gray-600 mb-4">Download a copy of your data.</p>
        <ExportManager />
      </section>

      <section>
        <h2 className="text-2xl font-semibold">Data Deletion</h2>
        <p className="text-gray-600 mb-4">Request to have your data permanently deleted.</p>
        <DeletionManager />
      </section>

      <section>
        <h2 className="text-2xl font-semibold">Audit Log</h2>
        <p className="text-gray-600 mb-4">View a log of all privacy-related events.</p>
        <AuditLogViewer />
      </section>
    </div>
  );
}
