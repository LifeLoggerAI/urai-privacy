export default function PrivacyPage() {
  return (
    <section className="hero">
      <div className="eyebrow">Public privacy promise</div>
      <h1>Consent, export, deletion, retention, and explanation are product surfaces.</h1>
      <p className="lede">This page translates the governance package into a user-facing privacy product: users can review consent status, create export/deletion requests, inspect retention behavior, and see auditable privacy activity.</p>
      <div className="grid">
        <article className="card"><h3>No silent escalation</h3><p className="muted">New processing purposes require manifest review, consent mapping, retention mapping, and audit coverage.</p></article>
        <article className="card"><h3>User-owned workflows</h3><p className="muted">Export and deletion requests are created by authenticated users and scoped to their own UID.</p></article>
        <article className="card"><h3>Admin accountability</h3><p className="muted">Admin review actions are recorded with actor, target, request, metadata, source, and timestamp.</p></article>
      </div>
    </section>
  );
}
