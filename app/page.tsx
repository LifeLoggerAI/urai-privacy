
import { NextPage } from 'next';
import ConsentManager from '@/components/ConsentManager';
import ExportManager from '@/components/ExportManager';
import DeletionManager from '@/components/DeletionManager';
import AuditLogViewer from '@/components/AuditLogViewer';
import SiteLayout from '@/components/SiteLayout';

const DataControlCenter: NextPage = () => {
  return (
    <SiteLayout>
        <div className="prose prose-lg mx-auto p-8">
            <h1>Your Data, Your Control</h1>
            <p className="lead">
                Welcome to your data control center. Here, you can exercise your rights, manage your consent preferences, and see exactly how your data is being used.
            </p>

            <div className="space-y-12">
                <section id="consent-manager">
                    <h2>Consent Manager</h2>
                    <p>Grant, deny, and update your consent for different types of data processing. Your choices are granular and respected in real-time.</p>
                    <ConsentManager />
                </section>

                <section id="export-manager">
                    <h2>Data Export</h2>
                    <p>Download a complete copy of your data at any time. We provide a machine-readable export of all information we have stored.</p>
                    <ExportManager />
                </section>

                <section id="deletion-manager">
                    <h2>Data Deletion</h2>
                    <p>Request the permanent deletion of your account and all associated data. This action is irreversible and will be logged for accountability.</p>
                    <DeletionManager />
                </section>

                <section id="audit-log-viewer">
                    <h2>Activity & Access Log</h2>
                    <p>Transparency is a core principle. Here you can view a complete, immutable log of every access and action taken on your data, by you or by our systems.</p>
                    <AuditLogViewer />
                </section>
            </div>
        </div>
    </SiteLayout>
  );
};

export default DataControlCenter;
