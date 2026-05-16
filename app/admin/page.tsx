import { getPrivacyHealthReport, defaultRetentionPolicies } from "@/lib/privacy-workflows";

const report = getPrivacyHealthReport({ exportRequests: [], deletionRequests: [], policies: defaultRetentionPolicies, audits: [] });
const links = [["Privacy requests", "/admin/privacy-requests"], ["Audit log", "/admin/audit-log"], ["Retention", "/admin/retention"], ["Policies", "/admin/policies"]];

export default function AdminPage() {
  return (
    <section>
      <div className="eyebrow">Admin Console</div>
      <h1>Privacy operations control room</h1>
      <p className="lede">Admin routes require an admin custom claim or role document. Actions that view or mutate sensitive privacy workflows must write admin action and audit records.</p>
      <div className="grid">
        <article className="card"><h3>Health verdict</h3><p><span className="status ok">{report.verdict}</span></p></article>
        <article className="card"><h3>Active policies</h3><p>{report.activePolicies}</p></article>
      </div>
      <div className="route-list">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
    </section>
  );
}
