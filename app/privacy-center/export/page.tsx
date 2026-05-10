import { createExportRequest } from "@/lib/privacy-workflows";

const preview = createExportRequest({ uid: "demo-user", role: "user" });

export default function ExportPage() {
  return (
    <section>
      <div className="eyebrow">Data export</div>
      <h1>Request a copy of your privacy data</h1>
      <p className="lede">A real request creates a `privacyRequests` record, an `exportJobs` record, and an `export_request_created` audit event scoped to the authenticated UID.</p>
      <div className="grid">
        <article className="card"><h3>Request status</h3><p><span className="status warn">{preview.request.status}</span></p><p className="muted">Request type: {preview.request.type}</p></article>
        <article className="card"><h3>Export job</h3><p><span className="status warn">{preview.job.status}</span></p><p className="muted">Generated after authenticated submission.</p></article>
        <article className="card"><h3>Audit event</h3><p>{preview.audit.action}</p><p className="muted">Actor and target UID are the same for user-owned export requests.</p></article>
      </div>
    </section>
  );
}
