
'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFirebase } from '../../providers';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }) {
  const { user } = useFirebase();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      user.getIdTokenResult().then(tokenResult => {
        if (tokenResult.claims.admin) {
          setIsAdmin(true);
        } else {
          router.push('/');
        }
      });
    } else {
      router.push('/');
    }
  }, [user, router]);

  if (!isAdmin) {
    return <div>Loading...</div>; // Or a more sophisticated loading component
  }

  return (
    <div className="flex">
      <aside className="w-64 p-4 border-r">
        <nav className="flex flex-col gap-2">
          <Link href="/admin" className="font-bold">Dashboard</Link>
          <Link href="/admin/policies">Policies</Link>
          <Link href="/admin/consent-tiers">Consent Tiers</Link>
          <Link href="/admin/transparency">Transparency</Link>
          <Link href="/admin/requests">Data Rights</Link>
          <Link href="/admin/users">Users</Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
