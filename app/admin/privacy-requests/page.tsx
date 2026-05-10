import type { PrivacyRequest } from "@/lib/privacy-types";
import { updateRequestStatus } from "@/lib/privacy-workflows";

const request: PrivacyRequest = { id: "preq_demo", uid: "demo-user", type: "export", status: "pending", createdAt: "2026-05-10T00:00:00.000Z", updatedAt: "2026-05-10T00:00:00.000Z" };
const reviewed = updateRequestStatus({ uid: "admin-demo", role: "admin", isAdmin: true }, request, "approved");

export default function AdminPrivacyRequestsPage() {
  return (
    <section>
      <div className="eyebrow">Admin review</div>
      <h1>Privacy requests</h1>
      <p className="lede">Admins can review export and deletion requests, update status, and record auditable admin actions. Firestore rules and Functions enforce admin role checks.</p>
      <table className="table"><thead><tr><th>Request</th><th>User</th><th>Type</th><th>Status</th><th>Audit</th></tr></thead><tbody><tr><td>{reviewed.request.id}</td><td>{reviewed.request.uid}</td><td>{reviewed.request.type}</td><td>{reviewed.request.status}</td><td>{reviewed.audit.action}</td></tr></tbody></table>
    </section>
  );
}
