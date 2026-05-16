"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AuthGate } from "@/components/AuthGate";
import { subscribeUserAuditLogs } from "@/lib/firebase-privacy-client";

export default function AuditLogPage() {
  return (
    <section>
      <div className="eyebrow">Personal audit log</div>
      <h1>Your privacy activity</h1>
      <p className="lede">Authenticated users can view privacy-relevant audit events scoped to their own UID through Firestore rules. No generated demo ledger rows are rendered.</p>
      <AuthGate>{(user) => <AuditLogTable user={user} />}</AuthGate>
    </section>
  );
}

function AuditLogTable({ user }: { user: User }) {
  const [audits, setAudits] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => subscribeUserAuditLogs(user.uid, setAudits), [user.uid]);

  if (audits.length === 0) {
    return <article className="card"><h3>No audit events yet</h3><p className="muted">Privacy actions will appear here after export, deletion, consent, admin, or policy events are written for your UID.</p></article>;
  }

  return (
    <table className="table">
      <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Source</th></tr></thead>
      <tbody>{audits.map((audit) => <tr key={String(audit.id)}><td>{String(audit.action ?? "unknown")}</td><td>{String(audit.actorUid ?? "unknown")}</td><td>{String(audit.targetUid ?? "unknown")}</td><td>{String(audit.source ?? "unknown")}</td></tr>)}</tbody>
    </table>
  );
}