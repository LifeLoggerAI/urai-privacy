'use client';

import { useState } from 'react';
import PolicyHeader from '../components/PolicyHeader';
import TrustFooter from '../components/TrustFooter';

export default function DataActionsPage() {
  const [exportStatus, setExportStatus] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');

  const handleExport = async () => {
    setExportStatus('pending');
    setTimeout(() => {
      setExportStatus('completed');
    }, 2000);
  };

  const handleDelete = async () => {
    setDeleteStatus('pending');
    setTimeout(() => {
      setDeleteStatus('completed');
    }, 2000);
  };

  return (
    <main className="bg-white text-gray-800">
      <div className="container mx-auto px-4 py-8">
        <PolicyHeader
          title="Your Controls"
          lastUpdated="2024-07-30"
        />
        <article className="prose max-w-none mt-8">
          <section>
            <h2>Export Your Data</h2>
            <p>
              You can request an export of your data at any time. We will package
              it in a structured JSON format and provide you with a download link.
            </p>
            <button
              className="px-4 py-2 rounded-md bg-blue-600 text-white"
              onClick={handleExport}
              disabled={exportStatus === 'pending'}
            >
              {exportStatus === 'pending'
                ? 'Exporting...'
                : 'Export My Data'}
            </button>
            {exportStatus === 'completed' && (
              <p className="text-green-500">Your data export is ready!</p>
            )}
          </section>

          <section>
            <h2>Delete Your Data</h2>
            <p>
              You can request the deletion of your data. This action is
              irreversible and will permanently remove all your information from
              our systems.
            </p>
            <button
              className="px-4 py-2 rounded-md bg-red-600 text-white"
              onClick={handleDelete}
              disabled={deleteStatus === 'pending'}
            >
              {deleteStatus === 'pending'
                ? 'Deleting...'
                : 'Delete My Data'}
            </button>
            {deleteStatus === 'completed' && (
              <p className="text-green-500">Your data has been deleted.</p>
            )}
          </section>
        </article>
      </div>
      <TrustFooter contactEmail="contact@urai.privacy" />
    </main>
  );
}
