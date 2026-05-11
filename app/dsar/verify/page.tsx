'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { functions } from '../../../lib/firebase';
import { httpsCallable } from 'firebase/functions';

const verifyDsarRequest = httpsCallable(functions, 'verifyDsarRequest');

function VerifyRequest() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const requestId = searchParams.get('requestId');
  const [message, setMessage] = useState('Verifying your request...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token && requestId) {
      verifyDsarRequest({ token, requestId })
        .then(() => {
          setMessage('Your request has been verified. Our team will review it shortly.');
        })
        .catch((err) => {
          setError(err.message);
          setMessage('Verification failed.');
        });
    } else {
      setMessage('Missing verification token or request ID.');
    }
  }, [token, requestId]);

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">DSAR Request Verification</h1>
      <div className="max-w-lg mx-auto">
        <p>{message}</p>
        {error && <p className="text-red-500 text-xs italic mt-4">{error}</p>}
      </div>
    </>
  );
}

export default function VerifyRequestPage() {
  return (
    <Suspense fallback={'Loading...'}>
      <VerifyRequest />
    </Suspense>
  );
}
