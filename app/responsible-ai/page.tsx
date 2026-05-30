export default function ResponsibleAiPage() {
  return (
    <section className="hero">
      <div className="eyebrow">Responsible AI</div>
      <h1>Responsible AI starts with restraint.</h1>
      <p className="lede">URAI responsible AI principles focus on consent, clarity, purpose limitation, user control, careful claims, privacy by architecture, and visible safety boundaries.</p>
      <div className="grid">
        <article className="card"><h2>Explainable boundaries</h2><p className="muted">Users should know why a system is asking for data, what it powers, and what it does not do.</p></article>
        <article className="card"><h2>Careful inference</h2><p className="muted">Sensitive inference requires explicit consent and should never be presented as medical diagnosis.</p></article>
        <article className="card"><h2>Auditable operations</h2><p className="muted">Export, deletion, admin review, and consent changes should leave appropriate audit evidence.</p></article>
      </div>
      <p><a className="button primary" href="/safety">Safety boundaries</a><a className="button" href="/privacy">Privacy policy</a></p>
    </section>
  );
}
