import type { ConsentRecord } from "@/lib/privacy-types";
import { updateConsent } from "@/lib/privacy-workflows";

const consent: ConsentRecord = { id: "consent-demo", uid: "demo-user", purpose: "AI privacy explanations", status: "granted", consentTier: "C4", policyVersion: "0.1.0-draft", updatedAt: "2026-05-10T00:00:00.000Z" };
const preview = updateConsent({ uid: "demo-user", role: "user" }, consent, "revoked");

export default function ConsentPage() {
  return (
    <section>
      <div className="eyebrow">Consent</div>
      <h1>Manage privacy consent preferences</h1>
      <p className="lede">Consent changes are scoped to the authenticated user and produce a `consent_updated` audit event.</p>
      <div className="grid">
        <article className="card"><h3>{preview.consent.purpose}</h3><p><span className="status warn">{preview.consent.status}</span></p><p className="muted">Tier: {preview.consent.consentTier}</p></article>
        <article className="card"><h3>Audit event</h3><p>{preview.audit.action}</p><p className="muted">Policy version: {preview.consent.policyVersion}</p></article>
      </div>
    </section>
  );
}
