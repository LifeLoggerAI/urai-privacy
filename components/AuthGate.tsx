"use client";

import { onAuthStateChanged, signInAnonymously, type Auth, type User } from "firebase/auth";
import { type ReactNode, useEffect, useState } from "react";
import { auth } from "../firebase/firebase";

type AuthGateProps = {
  children: (user: User) => ReactNode;
  adminOnly?: boolean;
};

function requireFirebaseAuth(): Auth | null {
  return auth;
}

export function AuthGate({ children, adminOnly = false }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const firebaseAuth = requireFirebaseAuth();

    if (!firebaseAuth) {
      setError("Firebase Auth is not configured.");
      setStatus("error");
      return;
    }

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (nextUser) => {
        if (nextUser) {
          setUser(nextUser);
          setStatus("ready");
          return;
        }

        try {
          const credential = await signInAnonymously(firebaseAuth);
          setUser(credential.user);
          setStatus("ready");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to initialize authentication.");
          setStatus("error");
        }
      },
      (err) => {
        setError(err.message);
        setStatus("error");
      }
    );

    return () => unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-slate-300">
        Preparing secure privacy session...
      </section>
    );
  }

  if (status === "error" || !user) {
    return (
      <section className="rounded-3xl border border-red-300/20 bg-red-950/30 p-6 text-red-100">
        <h2 className="text-lg font-semibold">Authentication unavailable</h2>
        <p className="mt-2 text-sm text-red-100/80">{error ?? "A signed-in user is required."}</p>
      </section>
    );
  }

  if (adminOnly && user.email !== process.env.NEXT_PUBLIC_URAI_ADMIN_EMAIL) {
    return (
      <section className="rounded-3xl border border-amber-300/20 bg-amber-950/30 p-6 text-amber-100">
        <h2 className="text-lg font-semibold">Admin access required</h2>
        <p className="mt-2 text-sm text-amber-100/80">
          This privacy administration surface requires an authorized admin account.
        </p>
      </section>
    );
  }

  return <>{children(user)}</>;
}
