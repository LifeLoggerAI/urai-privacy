import type { PolicyVersion } from "@/lib/privacy-types";

const policies: PolicyVersion[] = [
  { id: "policy-0-1-0", version: "0.1.0-draft", title: "Operational draft governance package", status: "draft", effectiveAt: "2026-05-10T00:00:00.000Z", createdAt: "2026-05-10T00:00:00.000Z" }
];

export default function AdminPoliciesPage() {
  return (
    <section>
      <div className="eyebrow">Policy publishing</div>
      <h1>Policy versions</h1>
      <p className="lede">Historical policy versions must be immutable after publication. Admin publishing actions require audit events and release evidence.</p>
      <table className="table"><thead><tr><th>Version</th><th>Title</th><th>Status</th><th>Effective</th></tr></thead><tbody>{policies.map((policy) => <tr key={policy.id}><td>{policy.version}</td><td>{policy.title}</td><td>{policy.status}</td><td>{policy.effectiveAt}</td></tr>)}</tbody></table>
    </section>
  );
}
