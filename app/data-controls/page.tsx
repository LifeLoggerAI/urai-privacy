export default function DataControlsPage() {
  return (
    <section className="hero">
      <div className="eyebrow">Data controls</div>
      <h1>Data should be visible, controllable, and bounded.</h1>
      <p className="lede">URAI data controls define how users review permissions, understand data categories, request exports, request deletion, and see the boundaries around sensitive inference.</p>
      <div className="grid">
        <article className="card"><h2>Export</h2><p className="muted">Users need a practical path to request a copy of eligible data.</p></article>
        <article className="card"><h2>Delete</h2><p className="muted">Deletion must be operational, auditable, and clear about lawful retention boundaries.</p></article>
        <article className="card"><h2>Consent</h2><p className="muted">Permission categories should be specific enough to prevent hidden reuse or silent expansion.</p></article>
      </div>
      <p><a className="button primary" href="/delete-export">Delete or export</a><a className="button" href="/consent">Consent principles</a></p>
    </section>
  );
}
