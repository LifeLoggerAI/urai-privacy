"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User
} from "firebase/auth";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { auth } from "../firebase/firebase";

type AuthGateProps = {
  children: (user: User) => ReactNode;
  adminOnly?: boolean;
};

type GateStatus = "loading" | "signed-out" | "ready" | "forbidden" | "error";

function requireFirebaseAuth(): Auth | null {
  return auth;
}

async function hasAdminClaim(user: User) {
  const token = await user.getIdTokenResult(true);
  return token.claims.admin === true || token.claims.role === "admin";
}

export function AuthGate({ children, adminOnly = false }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<GateStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const firebaseAuth = requireFirebaseAuth();

    if (!firebaseAuth) {
      setUser(null);
      setError("Firebase Auth is not configured.");
      setStatus("error");
      return;
    }

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (nextUser) => {
        setError(null);

        if (!nextUser) {
          setUser(null);
          setStatus("signed-out");
          return;
        }

        try {
          if (adminOnly && !(await hasAdminClaim(nextUser))) {
            setUser(null);
            setStatus("forbidden");
            return;
          }

          setUser(nextUser);
          setStatus("ready");
        } catch (err) {
          setUser(null);
          setError(err instanceof Error ? err.message : "Unable to verify the signed-in session.");
          setStatus("error");
        }
      },
      (err) => {
        setUser(null);
        setError(err.message);
        setStatus("error");
      }
    );

    return () => unsubscribe();
  }, [adminOnly]);

  const signIn = useCallback(async () => {
    const firebaseAuth = requireFirebaseAuth();

    if (!firebaseAuth) {
      setUser(null);
      setError("Firebase Auth is not configured.");
      setStatus("error");
      return;
    }

    setError(null);
    setStatus("loading");

    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      setStatus("signed-out");
    }
  }, []);

  const signOutCurrentUser = useCallback(async () => {
    const firebaseAuth = requireFirebaseAuth();
    if (!firebaseAuth) return;

    await signOut(firebaseAuth);
    setUser(null);
    setStatus("signed-out");
  }, []);

  if (status === "loading") {
    return (
      <section
        className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-slate-300"
        aria-live="polite"
      >
        Preparing secure privacy session...
      </section>
    );
  }

  if (status === "signed-out") {
    return (
      <section className="rounded-3xl border border-cyan-300/20 bg-cyan-950/25 p-6 text-cyan-50">
        <h2 className="text-lg font-semibold">Sign in required</h2>
        <p className="mt-2 text-sm text-cyan-100/80">
          Privacy exports, deletion requests, consent changes, and audit logs require an explicit
          signed-in account. Anonymous sessions are not used for these workflows.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-100" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button primary mt-4" type="button" onClick={signIn}>
          Sign in securely
        </button>
      </section>
    );
  }

  if (status === "forbidden") {
    return (
      <section
        className="rounded-3xl border border-amber-300/20 bg-amber-950/30 p-6 text-amber-100"
        role="alert"
      >
        <h2 className="text-lg font-semibold">Admin access required</h2>
        <p className="mt-2 text-sm text-amber-100/80">
          This privacy administration surface requires a Firebase Auth admin custom claim. A public
          environment variable is not accepted as proof of admin authorization.
        </p>
        <button className="button mt-4" type="button" onClick={signOutCurrentUser}>
          Sign out
        </button>
      </section>
    );
  }

  if (status === "error" || !user) {
    return (
      <section
        className="rounded-3xl border border-red-300/20 bg-red-950/30 p-6 text-red-100"
        role="alert"
      >
        <h2 className="text-lg font-semibold">Authentication unavailable</h2>
        <p className="mt-2 text-sm text-red-100/80">
          {error ?? "A signed-in user is required."}
        </p>
      </section>
    );
  }

  return <>{children(user)}</>;
}