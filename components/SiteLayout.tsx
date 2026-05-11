"use client";

import Link from "next/link";
import { useAuth } from "../firebase/AuthContext";

export default function SiteLayout({ children }) {
    const { user } = useAuth();
  return (
    <div className="container mx-auto p-4">
        <nav className="flex justify-between items-center mb-4">
            <Link href="/">Home</Link>
            <Link href="/policies">Policies</Link>
            <Link href="/consent">Consent</Link>
            <Link href="/transparency">Transparency</Link>
            <Link href="/data-rights">Data Rights</Link>
            {user && <Link href="/admin">Go to Admin</Link>}
        </nav>
      <main>{children}</main>
    </div>
  );
}
