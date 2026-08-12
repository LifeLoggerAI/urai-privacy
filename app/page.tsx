const pillars = [
  {
    title: "Passport",
    body: "See the identity, provenance, permissions, connected services, and data relationships URAI can use on your behalf.",
    href: "/privacy-center/passport",
  },
  {
    title: "Permissions",
    body: "Review consent by category, understand what each permission enables, and narrow or revoke access when you choose.",
    href: "/privacy-center/consent",
  },
  {
    title: "Your data",
    body: "Understand what information is retained, where it comes from, and the controls available for storage and connected services.",
    href: "/privacy-center/data",
  },
  {
    title: "Export and deletion",
    body: "Request a copy of supported data or begin a deletion request with clear confirmation and status information.",
    href: "/privacy-center/delete",
  },
  {
    title: "Responsible AI",
    body: "Review the principles URAI uses for inference, uncertainty, emotional sensitivity, accessibility, and human oversight.",
    href: "/privacy-center/responsible-ai",
  },
  {
    title: "Privacy requests",
    body: "Find the right path for questions, access requests, corrections, or concerns without exposing internal review tools.",
    href: "/privacy-center/requests",
  },
];

export default function HomePage() {
  return (
    <section className="hero" aria-labelledby="privacy-title">
      <div className="eyebrow">URAI Privacy</div>
      <h1 id="privacy-title">Your information should remain understandable and under your control.</h1>
      <p className="lede">
        Review what URAI can access, why a permission matters, what is stored, and the choices available to you. Sensitive controls are separated from the core experience so consent can be changed without navigating a maze of settings.
      </p>
      <p>
        <a className="button primary" href="/privacy-center">Open Privacy Center</a>
        <a className="button" href="/privacy-center/consent">Review permissions</a>
        <a className="button" href="/privacy-center/delete">Export or delete data</a>
      </p>

      <div className="grid" aria-label="Privacy controls">
        {pillars.map((pillar) => (
          <article className="card" key={pillar.title}>
            <h2>{pillar.title}</h2>
            <p className="muted">{pillar.body}</p>
            <p><a href={pillar.href}>Open {pillar.title}</a></p>
          </article>
        ))}
      </div>

      <section className="card" aria-labelledby="privacy-boundary-title">
        <h2 id="privacy-boundary-title">Public guidance. Protected review.</h2>
        <p className="muted">
          The Privacy Center explains your choices and request paths. Internal audit evidence, identity checks, and request handling stay behind protected access and are not exposed through public pages.
        </p>
        <p><a className="button" href="/privacy">Read the Privacy Policy</a></p>
      </section>
    </section>
  );
}
