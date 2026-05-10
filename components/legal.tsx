import type { ReactNode } from "react";

export function LegalPageShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="hero">
      <div className="eyebrow">URAI Privacy legal</div>
      <h1>{title}</h1>
      {description ? <p className="lede">{description}</p> : null}
      <div className="panel">{children}</div>
    </section>
  );
}

export function LegalNoticeCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </article>
  );
}

export function ContactPrivacyLegal() {
  return (
    <div className="grid">
      <LegalNoticeCard title="Privacy requests">
        Use the Privacy Center for export, deletion, consent, retention, and audit-log workflows.
      </LegalNoticeCard>
      <LegalNoticeCard title="Security reports">
        Do not include secrets or personal data in public issues. Use private security reporting channels for sensitive reports.
      </LegalNoticeCard>
      <LegalNoticeCard title="Legal review status">
        Public templates remain operational drafts until qualified legal review is recorded.
      </LegalNoticeCard>
    </div>
  );
}

export default LegalPageShell;
