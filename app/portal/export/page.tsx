
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/firebase/AuthContext';
import { requestDataExport } from '@/lib/privacy';

export default function ExportPage() {
  const { user } = useAuth();
  const [exportRequests, setExportRequests] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'data_exports'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: any[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setExportRequests(requests);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRequestExport = async () => {
    setIsSubmitting(true);
    try {
      await requestDataExport();
      // The UI will update automatically due to the onSnapshot listener
    } catch (error) {
      console.error('Failed to request data export', error);
      alert('Failed to request data export. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Data Export</h1>
      
      <button 
        onClick={handleRequestExport}
        disabled={isSubmitting}
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-400">
        {isSubmitting ? 'Requesting...' : 'Request New Data Export'}
      </button>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Your Export Requests</h2>
        <div className="space-y-4">
          {exportRequests.map((request) => (
            <div key={request.id} className="p-4 border rounded-lg">
              <p><strong>Request ID:</strong> {request.id}</p>
              <p><strong>Status:</strong> {request.status}</p>
              <p><strong>Requested At:</strong> {new Date(request.requestedAt.seconds * 1000).toLocaleString()}</p>
              {request.status === 'completed' && request.downloadUrl && (
                <a href={request.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  Download Export
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
