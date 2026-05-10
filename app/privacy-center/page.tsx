const links = [
  ["Request export", "/privacy-center/export"],
  ["Request deletion", "/privacy-center/delete"],
  ["Retention", "/privacy-center/retention"],
  ["Consent", "/privacy-center/consent"],
  ["Audit log", "/privacy-center/audit-log"]
];

export default function PrivacyCenterPage() {
  return (
    <section>
      <div className="eyebrow">Privacy Center</div>
      <h1>Your privacy operations dashboard</h1>
      <p className="lede">Authenticated users use this center to manage consent, request exports, request deletion, review retention behavior, and inspect privacy audit events. Route protection is enforced by the Firebase/Auth guard contract and Firestore rules.</p>
      <div className="route-list">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
    </section>
  );
}
