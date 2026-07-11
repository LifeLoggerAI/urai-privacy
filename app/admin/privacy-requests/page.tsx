"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { callPrivacyFunction, executeDeletionRequest, subscribeAdminCollection } from "@/lib/firebase-privacy-client";

const statuses = ["approved", "processing", "rejected", "failed"] as const;

type AdminStatus = (typeof statuses)[number];

export default function AdminPrivacyRequestsPage() {
  return (
    <section>
      <div className="eyebrow">Admin review</div>
      <h1>Privacy requests</h1>
      <p className="lede">Admins can review live export and deletion requests. Access is checked using trusted Firebase Auth custom claims before any privacy record is shown.</p>
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
      setMessage(`Deletion request updated: ${String(result.requestId ?? requestId)} -> ${String(result.status ?? status)}. Use dry-run and execute controls for destructive completion.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deletion status update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function runDeletionExecutor(requestId: string, mode: "dryRun" | "execute", expectedPlanHash?: string) {
    setBusyId(`${requestId}:${mode}`);
    setMessage("");
    try {
      const result = await executeDeletionRequest({ requestId, mode, expectedPlanHash });
      const suffix = mode === "dryRun" ? ` Plan hash: ${String(result.planHash ?? "missing")}` : " Residual verification passed.";
      setMessage(`Deletion ${mode} completed for ${String(result.requestId ?? requestId)} -> ${String(result.status ?? "unknown")}.${suffix}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Deletion ${mode} failed`);
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
        <p className="muted">Run dry-run first. Execute requires the latest stable plan hash. Completion is final only after an independent residual scan confirms no supported Firestore, export-object, Auth, or legal-hold target remains.</p>
        {deletionRequests.length === 0 ? <p className="muted">No deletion requests found.</p> : deletionRequests.map((request) => {
          const requestId = String(request.id);
          const planHash = typeof request.planHash === "string" ? request.planHash : undefined;
          const rawStatus = String(request.status);
          const completionRequired = request.deletionCompletionVerificationRequired === true;
          const completionVerified = request.deletionCompletionVerified === true;
          const verifiedComplete = rawStatus === "completed" && completionVerified && !completionRequired;
          const displayStatus = rawStatus === "completed" && !verifiedComplete
            ? "completion verification required"
            : rawStatus;
          return (
            <div key={requestId} className="panel">
              <strong>{requestId}</strong>
              <p className="muted">{String(request.uid)} · {displayStatus}</p>
              {request.destructiveDeletionBlocked ? <p><span className="status warn">destructive deletion gated</span></p> : null}
              {completionRequired ? <p><span className="status warn">completion is not yet verified</span></p> : null}
              {verifiedComplete ? <p><span className="status ok">deletion completion verified</span></p> : null}
              {planHash ? <p className="muted">Plan hash: <code>{planHash}</code></p> : null}
              {statuses.map((status) => <button className="button" type="button" disabled={busyId !== null || verifiedComplete} key={status} onClick={() => processDeletion(requestId, status)}>{status}</button>)}
              <button className="button primary" type="button" disabled={busyId !== null || verifiedComplete} onClick={() => runDeletionExecutor(requestId, "dryRun")}>Dry run</button>
              <button className="button" type="button" disabled={busyId !== null || !planHash || rawStatus === "completed"} onClick={() => runDeletionExecutor(requestId, "execute", planHash)}>Execute deletion</button>
            </div>
          );
        })}
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
          <button className="button" type="button" disabled={busyId !== null || String(job.status) === "completed"} onClick={() => processExport(String(job.id))}>{String(job.status) === "completed" ? "Processed" : "Process export"}</button>
        </div>
      ))}
    </article>
  );
}
