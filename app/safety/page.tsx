export default function SafetyPage() {
  return (
    <section className="hero">
      <div className="eyebrow">Safety boundaries</div>
      <h1>URAI is not an emergency service.</h1>
      <p className="lede">URAI may support reflection, memory, and pattern awareness, but it does not replace medical care, therapy, crisis support, emergency services, or human judgment.</p>
      <div className="grid">
        <article className="card"><h2>Human support first</h2><p className="muted">If someone may be in immediate danger, they should contact local emergency services or a trusted human support resource.</p></article>
        <article className="card"><h2>Careful messaging</h2><p className="muted">Notifications, SMS, email, and companion messages should avoid manipulative urgency and respect user consent.</p></article>
        <article className="card"><h2>Privacy under stress</h2><p className="muted">Sensitive moments require stronger boundaries, not broader hidden access.</p></article>
      </div>
      <p><a className="button primary" href="/responsible-ai">Responsible AI</a><a className="button" href="/what-urai-does-not-do">What URAI does not do</a></p>
    </section>
  );
}
