import { createAuditLog } from "@/lib/privacy-workflows";

const audits = [
  createAuditLog({ actor: { uid: "demo-user", role: "user" }, action: "export_request_created", targetUid: "demo-user", requestId: "preq_demo", source: "web" }),
  createAuditLog({ actor: { uid: "demo-user", role: "user" }, action: "consent_updated", targetUid: "demo-user", source: "web", metadata: { purpose: "AI privacy explanations" } })
];

export default function AuditLogPage() {
  return (
    <section>
      <div className="eyebrow">Personal audit log</div>
      <h1>Your privacy activity</h1>
      <p className="lede">Users can view privacy-relevant activity scoped to their own UID. Admin and system events must remain least-privilege and rules-enforced.</p>
      <table className="table">
        <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Source</th></tr></thead>
        <tbody>{audits.map((audit) => <tr key={audit.id}><td>{audit.action}</td><td>{audit.actorUid}</td><td>{audit.targetUid}</td><td>{audit.source}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
