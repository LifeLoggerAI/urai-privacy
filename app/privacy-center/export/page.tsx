"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AuthGate } from "@/components/AuthGate";
import { createExportRequest, subscribeUserCollection } from "@/lib/firebase-privacy-client";

export default function ExportPage() {
  return (
    <section>
      <div className="eyebrow">Data export</div>
      <h1>Request a copy of your privacy data</h1>
      <p className="lede">Authenticated users can create a live export request. The backend writes a privacy request, export job, and audit event scoped to the authenticated UID.</p>
      <AuthGate>{(user) => <ExportRequestPanel user={user} />}</AuthGate>
    </section>
  );
}

function ExportRequestPanel({ user }: { user: User }) {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeUserCollection("exportJobs", user.uid, setJobs), [user.uid]);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const result = await createExportRequest();
      setMessage(`Export request created: ${String(result.requestId ?? "unknown")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <article className="card">
        <h3>Create request</h3>
        <p className="muted">Signed in as {user.email ?? user.uid}. No demo user is used.</p>
        <button className="button primary" type="button" disabled={busy} onClick={submit}>{busy ? "Submitting..." : "Request export"}</button>
        {message ? <p className="muted">{message}</p> : null}
      </article>
      <article className="card">
        <h3>Recent export jobs</h3>
        {jobs.length === 0 ? <p className="muted">No export jobs found for this user.</p> : (
          <ul>
            {jobs.map((job) => <li key={String(job.id)}>{String(job.status ?? "unknown")} · {String(job.exportManifestPath ?? "manifest pending")}</li>)}
          </ul>
        )}
      </article>
    </div>
  );
}