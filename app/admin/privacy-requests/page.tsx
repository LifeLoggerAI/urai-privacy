"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { callPrivacyFunction, subscribeAdminCollection } from "@/lib/firebase-privacy-client";

const statuses = ["approved", "processing", "rejected", "failed"] as const;

type AdminStatus = (typeof statuses)[number];

export default function AdminPrivacyRequestsPage() {
  return (
    <section>
      <div className="eyebrow">Admin review</div>
      <h1>Privacy requests</h1>
      <p className="lede">Admins can review live export and deletion requests. Admin access is checked through Firebase Auth custom claims or the admin role document before any data is shown.</p>
      <AuthGate adminOnly>{() => <AdminRequestsTable />}</AuthGate>
    </section>
  );
}

function AdminRequestsTable() {
  const [privacyRequests, setPrivacyRequests] = useState<Array<Record<string, unknown>>>([]);
  const [deletionRequests, setDeletionRequests] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => subscribeAdminCollection("privacyRequests", setPrivacyRequests), []);
  useEffect(() => subscribeAdminCollection("deletionRequests", setDeletionRequests), []);

  async function processDeletion(requestId: string, status: AdminStatus) {
    setBusyId(requestId);
    setMessage("");
    try {
      const result = await callPrivacyFunction("processDeletionRequest", { requestId, status });
      setMessage(`Deletion request updated: ${String(result.requestId ?? requestId)} -> ${String(result.status ?? status)}. Destructive completion remains gated until the production executor is verified.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deletion status update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function processExport(jobId: string) {
    setBusyId(jobId);
    setMessage("");
    try {
      const result = await callPrivacyFunction("processExportRequest", { jobId });
      setMessage(`Export job processed: ${String(result.jobId ?? jobId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export processing failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid">
      <article className="card">
        <h3>Privacy requests</h3>
        {privacyRequests.length === 0 ? <p className="muted">No privacy requests found.</p> : (
          <table className="table"><thead><tr><th>ID</th><th>User</th><th>Type</th><th>Status</th></tr></thead><tbody>{privacyRequests.map((request) => <tr key={String(request.id)}><td>{String(request.id)}</td><td>{String(request.uid)}</td><td>{String(request.type)}</td><td>{String(request.status)}</td></tr>)}</tbody></table>
        )}
      </article>
      <article className="card">
        <h3>Deletion requests</h3>
        <p className="muted">Completion is unavailable here until destructive deletion execution has legal-hold, retry, audit, and release evidence.</p>
        {deletionRequests.length === 0 ? <p className="muted">No deletion requests found.</p> : deletionRequests.map((request) => (
          <div key={String(request.id)} className="panel">
            <strong>{String(request.id)}</strong>
            <p className="muted">{String(request.uid)} · {String(request.status)}</p>
            {request.destructiveDeletionBlocked ? <p><span className="status warn">destructive deletion gated</span></p> : null}
            {statuses.map((status) => <button className="button" type="button" disabled={busyId !== null} key={status} onClick={() => processDeletion(String(request.id), status)}>{status}</button>)}
          </div>
        ))}
      </article>
      <ExportJobsPanel busyId={busyId} processExport={processExport} />
      {message ? <article className="card"><h3>Latest admin action</h3><p className="muted" aria-live="polite">{message}</p></article> : null}
    </div>
  );
}

function ExportJobsPanel({ busyId, processExport }: { busyId: string | null; processExport: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => subscribeAdminCollection("exportJobs", setJobs), []);

  return (
    <article className="card">
      <h3>Export jobs</h3>
      {jobs.length === 0 ? <p className="muted">No export jobs found.</p> : jobs.map((job) => (
        <div key={String(job.id)} className="panel">
          <strong>{String(job.id)}</strong>
          <p className="muted">{String(job.uid)} · {String(job.status)}</p>
          <button className="button" type="button" disabled={busyId !== null || String(job.status) === "completed"} onClick={() => processExport(String(job.id))}>{String(job.status) === "completed" ? "Processed" : "Mark processed"}</button>
        </div>
      ))}
    </article>
  );
}