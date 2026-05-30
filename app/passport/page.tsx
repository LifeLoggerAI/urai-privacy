export default function PassportPage() {
  return (
    <section className="hero">
      <div className="eyebrow">URAI Passport</div>
      <h1>Permission belongs to the user.</h1>
      <p className="lede">URAI Passport is the permission layer for the URAI ecosystem. It explains what a user has allowed, what is off, and where consent can be reviewed or changed.</p>
      <div className="grid">
        <article className="card"><h2>Clear permissions</h2><p className="muted">Passport should show consent by category, product surface, and purpose instead of hiding choices inside vague settings.</p></article>
        <article className="card"><h2>Revocation paths</h2><p className="muted">Users should be able to turn off future use, request export, or request deletion through visible privacy-center routes.</p></article>
        <article className="card"><h2>No silent escalation</h2><p className="muted">Sensitive data use must not expand beyond the permission a user understood and granted.</p></article>
      </div>
      <p><a className="button primary" href="/privacy-center/consent">Review consent</a><a className="button" href="/data-controls">View data controls</a></p>
    </section>
  );
}
