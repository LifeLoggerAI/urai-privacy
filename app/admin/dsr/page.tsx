'use client';

import { NextPage } from "next";
import { useEffect, useState } from "react";
import { db as firestore } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
// NOTE: In a real application, this would be a protected route with proper admin authorization.
// For this example, we're assuming the user is an admin.

interface DSR {
  id: string;
  userId: string;
  email: string;
  requestType: "ACCESS" | "EXPORT" | "DELETE";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";
  createdAt: Timestamp;
}

const DsrAdminPage: NextPage = () => {
  const [requests, setRequests] = useState<DSR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firestore, "dsr"),
      (snapshot) => {
        const fetchedRequests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<DSR, "id">),
        }));
        setRequests(fetchedRequests);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching DSRs:", err);
        setError("Failed to load data subject requests.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (id: string, status: DSR["status"]) => {
    const requestRef = doc(firestore, "dsr", id);
    try {
      await updateDoc(requestRef, { status });
    } catch (err) {
      console.error("Error updating DSR status:", err);
      // In a real app, you would show a toast or other notification.
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-6">
        Data Subject Request Dashboard
      </h1>

      {loading ? (
        <p>Loading requests...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">User Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Request Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Submitted At</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{req.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{req.requestType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(req.createdAt.toDate()).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : req.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {req.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleUpdateStatus(req.id, 'PROCESSING')} className="text-indigo-600 hover:text-indigo-900">Approve</button>
                        <button onClick={() => handleUpdateStatus(req.id, 'REJECTED')} className="text-red-600 hover:text-red-900">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DsrAdminPage;
