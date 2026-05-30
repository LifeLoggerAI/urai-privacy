export default function DeleteExportPage() {
  return (
    <section className="hero">
      <div className="eyebrow">Delete and export</div>
      <h1>Privacy requests must be operational, not symbolic.</h1>
      <p className="lede">URAI provides visible paths for eligible data export and deletion requests. Some requests may require identity verification, legal-hold review, or retained evidence for safety and compliance.</p>
      <div className="grid">
        <article className="card"><h2>Request export</h2><p className="muted">Users should be able to request a copy of eligible data through the privacy center.</p><p><a className="button" href="/privacy-center/export">Open export request</a></p></article>
        <article className="card"><h2>Request deletion</h2><p className="muted">Deletion should follow a reviewed workflow with dry-run checks, legal-hold boundaries, and audit evidence.</p><p><a className="button" href="/privacy-center/delete">Open deletion request</a></p></article>
        <article className="card"><h2>Review consent</h2><p className="muted">Changing future permissions may be the right first step before export or deletion.</p><p><a className="button" href="/privacy-center/consent">Review consent</a></p></article>
      </div>
    </section>
  );
}
