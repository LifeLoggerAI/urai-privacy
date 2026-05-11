
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/firebase/AuthContext';
import { requestDataDeletion } from '@/lib/privacy';
import { COLLECTIONS } from '@/lib/privacySchema'; // 1. IMPORT the canonical schema

export default function DeletePage() {
  const { user } = useAuth();
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    // 2. CORRECTED collection name to use the schema
    // 3. CORRECTED field name from 'userId' to 'uid'
    const q = query(collection(db, COLLECTIONS.DATA_DELETION_REQUESTS), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: any[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setDeletionRequests(requests);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRequestDeletion = async () => {
    if (confirm('Are you sure you want to permanently delete your account and all associated data? This action cannot be undone.')) {
      setIsSubmitting(true);
      try {
        await requestDataDeletion();
        // The UI will update automatically due to the onSnapshot listener
        // You might want to redirect the user or log them out here
      } catch (error) {
        console.error('Failed to request data deletion', error);
        alert('Failed to request data deletion. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Data Deletion</h1>
      
      <button 
        onClick={handleRequestDeletion}
        disabled={isSubmitting}
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-400">
        {isSubmitting ? 'Deleting...' : 'Request Account and Data Deletion'}
      </button>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Your Deletion Requests</h2>
        <div className="space-y-4">
          {deletionRequests.map((request) => (
            <div key={request.id} className="p-4 border rounded-lg">
              <p><strong>Request ID:</strong> {request.id}</p>
              <p><strong>Status:</strong> {request.status}</p>
              <p><strong>Requested At:</strong> {new Date(request.requestedAt.seconds * 1000).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
