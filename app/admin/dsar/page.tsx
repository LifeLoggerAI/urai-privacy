'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firestore as db, functions } from '../../../firebase/firebase';
import { httpsCallable } from 'firebase/functions';
import AdminLayout from '../../components/AdminLayout';

interface DsarRequest {
  id: string;
  email: string;
  requestType: 'export' | 'delete';
  status: string;
  createdAt: any;
}

const dataExport = httpsCallable(functions, 'dataExport');
const secureDelete = httpsCallable(functions, 'secureDelete');

export default function DsarAdminPage() {
  const [requests, setRequests] = useState<DsarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'dsarRequests'), (snapshot) => {
      const newRequests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DsarRequest));
      setRequests(newRequests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (request: DsarRequest) => {
    setError(null);
    try {
      if (request.requestType === 'export') {
        await dataExport();
      } else if (request.requestType === 'delete') {
        await secureDelete();
      }
      await updateDoc(doc(db, "dsarRequests", request.id), {
        status: "approved",
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReject = async (id: string) => {
    setError(null);
    try {
      await updateDoc(doc(db, "dsarRequests", id), {
        status: "rejected",
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-4">DSAR Requests</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Email</th>
                  <th className="py-2 px-4 border-b">Request Type</th>
                  <th className="py-2 px-4 border-b">Status</th>
                  <th className="py-2 px-4 border-b">Created At</th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td className="py-2 px-4 border-b">{req.email}</td>
                    <td className="py-2 px-4 border-b">{req.requestType}</td>
                    <td className="py-2 px-4 border-b">{req.status}</td>
                    <td className="py-2 px-4 border-b">{new Date(req.createdAt.seconds * 1000).toLocaleString()}</td>
                    <td className="py-2 px-4 border-b">
                      {req.status === 'in_review' && (
                        <>
                          <button onClick={() => handleApprove(req)} className="bg-green-500 text-white px-2 py-1 rounded mr-2">Approve</button>
                          <button onClick={() => handleReject(req.id)} className="bg-red-500 text-white px-2 py-1 rounded">Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
