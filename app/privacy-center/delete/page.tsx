import { createDeletionRequest } from "@/lib/privacy-workflows";

const preview = createDeletionRequest({ uid: "demo-user", role: "user" }, "User requested account/data deletion");

export default function DeletePage() {
  return (
    <section>
      <div className="eyebrow">Deletion request</div>
      <h1>Request account or privacy-data deletion</h1>
      <p className="lede">Deletion is never silent. The workflow creates an auditable request, marks status transitions, documents deleted versus retained records, and preserves legally required audit evidence.</p>
      <div className="grid">
        <article className="card"><h3>Status</h3><p><span className="status warn">{preview.request.status}</span></p><p className="muted">Scope: {preview.request.scope}</p></article>
        <article className="card"><h3>Deleted data</h3><p className="muted">{preview.request.deletedData.join(", ")}</p></article>
        <article className="card"><h3>Retained evidence</h3><p className="muted">{preview.request.retainedData.join(", ")}</p></article>
      </div>
    </section>
  );
}
