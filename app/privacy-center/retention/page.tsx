import { defaultRetentionPolicies } from "@/lib/privacy-workflows";

export default function RetentionPage() {
  return (
    <section>
      <div className="eyebrow">Retention</div>
      <h1>How privacy records are retained</h1>
      <p className="lede">Retention policies explain what is kept, why it is kept, and whether legal hold can override normal cleanup.</p>
      <div className="grid">
        {defaultRetentionPolicies.map((policy) => (
          <article className="card" key={policy.id}>
            <h3>{policy.collection}</h3>
            <p><span className="status ok">{policy.retentionClass}</span></p>
            <p className="muted">{policy.summary}</p>
            <p className="muted">Window: {policy.windowDays ?? "indefinite until policy changes"} days</p>
          </article>
        ))}
      </div>
    </section>
  );
}
