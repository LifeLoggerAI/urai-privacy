import { createAuditLog } from "@/lib/privacy-workflows";

const audit = createAuditLog({ actor: { uid: "admin-demo", role: "admin" }, action: "admin_viewed_request", targetUid: "demo-user", requestId: "preq_demo", source: "admin" });

export default function AdminAuditLogPage() {
  return <section><div className="eyebrow">Admin audit</div><h1>Audit evidence</h1><p className="lede">Admin-visible audit events include actor, role, action, target, request, metadata, source, and timestamp.</p><table className="table"><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Request</th><th>Source</th></tr></thead><tbody><tr><td>{audit.action}</td><td>{audit.actorUid}</td><td>{audit.targetUid}</td><td>{audit.requestId}</td><td>{audit.source}</td></tr></tbody></table></section>;
}
