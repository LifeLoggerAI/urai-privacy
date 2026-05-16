"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { type ReactNode, useEffect, useState } from "react";
import { auth, db, firebaseConfigStatus, isFirebaseConfigured } from "../../firebase/firebase";

type GateState = "checking" | "missing-config" | "signed-out" | "forbidden" | "ready";

interface AuthGateProps {
  adminOnly?: boolean;
  children: (user: User) => ReactNode;
}

async function userHasAdminAccess(user: User) {
  const token = await user.getIdTokenResult(true);
  if (token.claims.admin === true) return true;
  if (!db) return false;
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() && snap.data()?.role === "admin";
}

export function AuthGate({ adminOnly = false, children }: AuthGateProps) {
  const [state, setState] = useState<GateState>("checking");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setState("missing-config");
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setState("signed-out");
        return;
      }
      if (adminOnly && !(await userHasAdminAccess(nextUser))) {
        setState("forbidden");
        return;
      }
      setState("ready");
    });
  }, [adminOnly]);

  if (state === "checking") {
    return <StatusPanel title="Checking access" tone="warn">Validating Firebase configuration and authenticated session.</StatusPanel>;
  }

  if (state === "missing-config") {
    return (
      <StatusPanel title="Firebase configuration required" tone="danger">
        This route is blocked until the production Firebase web config is provided through environment variables. Missing flags: {Object.entries(firebaseConfigStatus).filter(([, ok]) => !ok).map(([key]) => key).join(", ") || "none"}.
      </StatusPanel>
    );
  }

  if (state === "signed-out") {
    return <StatusPanel title="Sign in required" tone="warn">Authenticate with the configured URAI Firebase Auth provider to continue. No anonymous or demo user is created automatically.</StatusPanel>;
  }

  if (state === "forbidden") {
    return <StatusPanel title="Admin access required" tone="danger">Your authenticated account does not have the admin custom claim or admin role document required for this route.</StatusPanel>;
  }

  if (!user) return null;
  return <>{children(user)}</>;
}

function StatusPanel({ title, tone, children }: { title: string; tone: "ok" | "warn" | "danger"; children: ReactNode }) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      <p><span className={`status ${tone}`}>{tone}</span></p>
      <p className="muted">{children}</p>
    </article>
  );
}