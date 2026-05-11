'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/firebase'; // Corrected import path
import { onAuthStateChanged, User } from 'firebase/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Ensure this runs only on the client side
    if (typeof window === 'undefined') {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    // Set a timeout to handle cases where Firebase auth takes too long
    // or doesn't respond, to avoid getting stuck in a loading state.
    const timer = setTimeout(() => {
        if (loading) {
            router.push('/login');
        }
    }, 5000);

    return () => {
        unsubscribe();
        clearTimeout(timer);
    }
  }, [router, loading]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return null; // Redirect is happening in useEffect
  }

  return <>{children}</>;
}
