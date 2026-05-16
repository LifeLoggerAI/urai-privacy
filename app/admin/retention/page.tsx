import { defaultRetentionPolicies } from "@/lib/privacy-workflows";

export default function AdminRetentionPage() {
  return (
    <section>
      <div className="eyebrow">Admin retention</div>
      <h1>Retention policies</h1>
      <p className="lede">Admins can inspect retention policy coverage before enabling cleanup jobs or legal holds.</p>
      <table className="table">
        <thead><tr><th>Collection</th><th>Class</th><th>Window</th><th>Legal hold</th></tr></thead>
        <tbody>{defaultRetentionPolicies.map((policy) => <tr key={policy.id}><td>{policy.collection}</td><td>{policy.retentionClass}</td><td>{policy.windowDays ?? "indefinite"}</td><td>{policy.legalHoldSupported ? "yes" : "no"}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
