import { getPrivacyHealthReport, defaultRetentionPolicies } from "@/lib/privacy-workflows";

const report = getPrivacyHealthReport({ exportRequests: [], deletionRequests: [], policies: defaultRetentionPolicies, audits: [] });
const links = [["Privacy requests", "/admin/privacy-requests"], ["Audit log", "/admin/audit-log"], ["Retention", "/admin/retention"], ["Policies", "/admin/policies"]];

export default function AdminPage() {
  return (
    <section>
      <div className="eyebrow">Admin Console</div>
      <h1>Privacy operations control room</h1>
      <p className="lede">Admin routes require an admin custom claim or role document. Actions that view or mutate sensitive privacy workflows must write admin action and audit records.</p>
      <article className="card">
        <h2>Production evidence boundary</h2>
        <p className="muted">
          This overview is a route shell and release-readiness summary, not proof of live Firebase health by itself. Use the linked request, audit, retention, and policy screens plus the deploy-time release ledger for operational proof.
        </p>
      </article>
      <div className="grid">
        <article className="card"><h3>Static readiness sample</h3><p><span className="status warn">{report.verdict}</span></p><p className="muted">Computed from local default policy data only.</p></article>
        <article className="card"><h3>Default policy templates</h3><p>{report.activePolicies}</p><p className="muted">Template count; not a live Firestore policy count.</p></article>
      </div>
      <div className="route-list">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
    </section>
  );
}
