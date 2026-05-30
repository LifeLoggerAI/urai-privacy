export default function ConsentPage() {
  return (
    <section className="hero">
      <div className="eyebrow">Consent principles</div>
      <h1>Consent should be specific, reversible, and understandable.</h1>
      <p className="lede">URAI consent pages explain what is allowed, why it is used, which system uses it, and how a user can change future permissions.</p>
      <div className="grid">
        <article className="card"><h2>Specific purpose</h2><p className="muted">Consent should be tied to a clear feature or system role, not broad invisible reuse.</p></article>
        <article className="card"><h2>Separate sensitive choices</h2><p className="muted">Biometric identity, sensitive inference, sharing, and monetization require distinct permission paths.</p></article>
        <article className="card"><h2>Changeable over time</h2><p className="muted">Users must be able to review, revoke, export, or delete where applicable.</p></article>
      </div>
      <p><a className="button primary" href="/privacy-center/consent">Open consent center</a><a className="button" href="/what-urai-does-not-do">What URAI does not do</a></p>
    </section>
  );
}
