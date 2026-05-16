const pillars = ["Consent ledger", "Data export", "Deletion workflow", "Audit evidence", "Retention policy", "Admin review"];

export default function HomePage() {
  return (
    <section className="hero">
      <div className="eyebrow">Standalone privacy operations</div>
      <h1>Privacy infrastructure for AI-native products.</h1>
      <p className="lede">URAI Privacy now has a Next.js product surface layered on top of the existing governance package. It provides user privacy-center routes, admin review routes, Firebase contracts, and auditable workflow helpers for export, deletion, consent, retention, and policy operations.</p>
      <p><a className="button primary" href="/privacy-center">Open Privacy Center</a><a className="button" href="/admin">Open Admin Console</a></p>
      <div className="grid">{pillars.map((pillar) => <article className="card" key={pillar}><h3>{pillar}</h3><p className="muted">Implemented as a verifiable product route or shared workflow contract with explicit audit behavior.</p></article>)}</div>
    </section>
  );
}
