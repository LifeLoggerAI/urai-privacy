type PageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  primary: string;
  secondary: string;
  bullets: string[];
};

export function PrivacyPage({ eyebrow, title, summary, primary, secondary, bullets }: PageProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2452_0%,#070817_48%,#02030a_100%)] px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-5xl rounded-[2rem] border border-cyan-200/15 bg-slate-950/55 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur md:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-cyan-200/80">{eyebrow}</p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">{title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{summary}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-semibold text-cyan-100">{primary}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Owner-first privacy controls, auditable decisions, and Firebase-backed enforcement paths are treated as product infrastructure, not policy decoration.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-semibold text-cyan-100">{secondary}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">This surface remains intentionally calm, restrained, and evidence-oriented so users can understand what data exists, why it exists, and what actions are available.</p>
          </div>
        </div>
        <ul className="mt-8 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          {bullets.map((bullet) => (
            <li key={bullet} className="rounded-2xl border border-cyan-200/10 bg-cyan-100/[0.03] p-4">{bullet}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
