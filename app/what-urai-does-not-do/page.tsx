export default function WhatUraiDoesNotDoPage() {
  return (
    <section className="hero">
      <div className="eyebrow">Boundaries</div>
      <h1>What URAI does not do.</h1>
      <p className="lede">URAI Privacy makes product boundaries visible so users, partners, and reviewers understand what the system should not claim or silently perform.</p>
      <div className="grid">
        <article className="card"><h2>No hidden consent expansion</h2><p className="muted">URAI should not silently expand data use beyond the purpose a user understood.</p></article>
        <article className="card"><h2>No therapy replacement claim</h2><p className="muted">URAI may support reflection and pattern awareness, but it is not a medical provider or emergency service.</p></article>
        <article className="card"><h2>No uncontrolled messaging</h2><p className="muted">Communications should respect opt-in, opt-out, timing, and user control.</p></article>
      </div>
      <p><a className="button primary" href="/safety">Safety boundaries</a><a className="button" href="/responsible-ai">Responsible AI</a></p>
    </section>
  );
}
