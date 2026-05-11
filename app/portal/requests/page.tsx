
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/firebase/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { firestore } from '@/firebase/firebase';
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function PortalRequests() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/portal');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(firestore, "dsarRequests"), where("ownerUid", "==", user.uid));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const requests = [];
        querySnapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() });
        });
        setRequests(requests);
      });
      return () => unsubscribe();
    }
  }, [user]);

  if (loading || !user) {
    return <p>Loading...</p>;
  }

  return (
    <div className="bg-white px-6 py-12 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-3xl text-base leading-7 text-gray-700">
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Your Requests</h1>
        <p className="mt-6 text-xl leading-8">Here is a list of your data subject access requests (DSARs).</p>
        <div className="mt-10">
          <Link href="/portal/export" className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 mr-4">
            Request Data Export
          </Link>
          <Link href="/portal/delete" className="rounded-md bg-red-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
            Request Data Deletion
          </Link>
        </div>

        <div className="mt-16">
          <ul role="list" className="divide-y divide-gray-100">
            {requests.map((request) => (
              <li key={request.id} className="flex justify-between gap-x-6 py-5">
                <div className="flex min-w-0 gap-x-4">
                  <div className="min-w-0 flex-auto">
                    <p className="text-sm font-semibold leading-6 text-gray-900">{request.type}</p>
                    <p className="mt-1 truncate text-xs leading-5 text-gray-500">{new Date(request.createdAt?.toDate()).toLocaleString()}</p>
                  </div>
                </div>
                <div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
                  <p className="text-sm leading-6 text-gray-900">{request.status}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
