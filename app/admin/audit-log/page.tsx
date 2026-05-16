"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { subscribeAdminCollection } from "@/lib/firebase-privacy-client";

export default function AdminAuditLogPage() {
  return (
    <section>
      <div className="eyebrow">Admin audit</div>
      <h1>Audit evidence</h1>
      <p className="lede">Admin-visible audit events are read from Firestore after admin access is verified. No generated demo audit row is rendered.</p>
      <AuthGate adminOnly>{() => <AdminAuditLogTable />}</AuthGate>
    </section>
  );
}

function AdminAuditLogTable() {
  const [audits, setAudits] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => subscribeAdminCollection("auditLogs", setAudits), []);

  if (audits.length === 0) {
    return <article className="card"><h3>No audit events found</h3><p className="muted">Admin-visible audit events will appear after user, system, policy, or admin actions are written.</p></article>;
  }

  return (
    <table className="table">
      <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Request</th><th>Source</th></tr></thead>
      <tbody>{audits.map((audit) => <tr key={String(audit.id)}><td>{String(audit.action ?? "unknown")}</td><td>{String(audit.actorUid ?? "unknown")}</td><td>{String(audit.targetUid ?? "unknown")}</td><td>{String(audit.requestId ?? "none")}</td><td>{String(audit.source ?? "unknown")}</td></tr>)}</tbody>
    </table>
  );
}