"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AuthGate } from "@/components/AuthGate";
import { createExportRequest, getExportDownloadUrl, subscribeUserCollection } from "@/lib/firebase-privacy-client";

export default function ExportPage() {
  return (
    <section>
      <div className="eyebrow">Data export</div>
      <h1>Request a copy of your privacy data</h1>
      <p className="lede">Authenticated users can create a live export request. Completed packages are retrieved through short-lived, owner-authorized download links instead of public Storage paths.</p>
      <AuthGate>{(user) => <ExportRequestPanel user={user} />}</AuthGate>
    </section>
  );
}

function ExportRequestPanel({ user }: { user: User }) {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [downloadBusyId, setDownloadBusyId] = useState<string | null>(null);

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

  async function openDownload(jobId: string, file: "export" | "manifest") {
    setDownloadBusyId(`${jobId}:${file}`);
    setMessage("");
    try {
      const result = await getExportDownloadUrl({ jobId, file });
      const url = String(result.url ?? "");
      if (!url) throw new Error("Signed download URL was not returned.");
      window.open(url, "_blank", "noopener,noreferrer");
      setMessage(`${file === "manifest" ? "Manifest" : "Export"} link opened. This link expires in ${String(result.expiresInSeconds ?? 900)} seconds.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export download failed");
    } finally {
      setDownloadBusyId(null);
    }
  }

  return (
    <div className="grid">
      <article className="card">
        <h3>Create request</h3>
        <p className="muted">Signed in as {user.email ?? user.uid}. No demo user is used.</p>
        <button className="button primary" type="button" disabled={busy} onClick={submit}>{busy ? "Submitting..." : "Request export"}</button>
        {message ? <p className="muted" aria-live="polite">{message}</p> : null}
      </article>
      <article className="card">
        <h3>Recent export jobs</h3>
        {jobs.length === 0 ? <p className="muted">No export jobs found for this user.</p> : (
          <ul>
            {jobs.map((job) => {
              const jobId = String(job.id);
              const status = String(job.status ?? "unknown");
              const complete = status === "completed";
              return (
                <li key={jobId}>
                  <strong>{status}</strong> · {String(job.exportManifestPath ?? "manifest pending")}
                  {complete ? (
                    <span>
                      <button className="button" type="button" disabled={downloadBusyId !== null} onClick={() => openDownload(jobId, "export")}>{downloadBusyId === `${jobId}:export` ? "Opening..." : "Open export"}</button>
                      <button className="button" type="button" disabled={downloadBusyId !== null} onClick={() => openDownload(jobId, "manifest")}>{downloadBusyId === `${jobId}:manifest` ? "Opening..." : "Open manifest"}</button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}