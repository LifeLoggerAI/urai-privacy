"use client";

import Link from "next/link";
import { useAuth } from "../../firebase/AuthContext";

export default function AdminLayout({ children }) {
    const { user } = useAuth();
  return (
    <div className="container mx-auto p-4">
        <nav className="flex justify-between items-center mb-4">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/policies">Policies</Link>
            <Link href="/admin/consent">Consent Tiers</Link>
            <Link href="/admin/transparency">Transparency</Link>
            <Link href="/admin/requests">Data Rights</Link>
            {(user && (user.role === 'owner' || user.role === 'admin')) && <Link href="/admin/users">Users</Link>}
            <Link href="/">Back to Site</Link>
        </nav>
      <main>{children}</main>
    </div>
  );
}
