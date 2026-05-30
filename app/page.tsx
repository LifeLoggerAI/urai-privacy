const pillars = [
  "URAI Passport",
  "Consent categories",
  "Data controls",
  "Delete and export paths",
  "Responsible AI principles",
  "Privacy request review",
];

export default function HomePage() {
  return (
    <section className="hero">
      <div className="eyebrow">URAI Privacy / Trust Center</div>
      <h1>Privacy is not a setting. It is the system.</h1>
      <p className="lede">
        URAI Privacy is the public trust center for Passport, consent categories, data controls,
        delete and export paths, responsible AI principles, safety boundaries, and privacy request review.
      </p>
      <p>
        <a className="button primary" href="/privacy-center">Explore Privacy Center</a>
        <a className="button" href="/privacy-center/consent">Review Consent</a>
        <a className="button" href="/privacy-center/delete">Delete / Export</a>
      </p>
      <div className="grid">
        {pillars.map((pillar) => (
          <article className="card" key={pillar}>
            <h3>{pillar}</h3>
            <p className="muted">
              Explained as a user-facing trust route with clear boundaries, request paths, and launch-safe wording.
            </p>
          </article>
        ))}
      </div>
      <section className="card" aria-label="Admin boundary">
        <h2>Public trust first. Admin tools stay protected.</h2>
        <p className="muted">
          Internal review, audit evidence, and request management belong behind protected admin access. Public pages should help users understand choices without exposing operational controls.
        </p>
        <p><a className="button" href="/privacy">Read Privacy Policy</a></p>
      </section>
    </section>
  );
}
