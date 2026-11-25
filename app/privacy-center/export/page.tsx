"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, firebaseApp } from "../../../firebase/firebase";
import { fetchAuthorizedExport, type ExportFile, type ExportSelection } from "@/lib/export-download-client";
import { AuthGate } from "@/components/AuthGate";
import { createExportRequest, getExportDownloadUrl, subscribeUserCollection } from "@/lib/firebase-privacy-client";

export default function ExportPage() {
  return (
    <section>
      <div className="eyebrow">Data export</div>
      <h1>Request a copy of your privacy data</h1>
      <p className="lede">Request an export, then download your completed package while your account and data export consent are active.</p>
      <AuthGate>{(user) => <ExportRequestPanel key={user.uid} user={user} />}</AuthGate>
    </section>
  );
}

function ExportRequestPanel({ user }: { user: User }) {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [downloadBusyId, setDownloadBusyId] = useState<string | null>(null);

  const active = useRef<{ controller: AbortController; jobId: string; receiptHash: unknown; matches: (row: Record<string, unknown>) => boolean } | null>(null);
  const grantedReceipt = useRef<unknown>(null);

  useEffect(() => {
    const cancel = () => {
      if (!active.current) return;
      active.current.controller.abort();
      active.current = null;
      setDownloadBusyId(null);
      setMessage("Download stopped because access changed.");
    };
    const stopJobs = subscribeUserCollection("exportJobs", user.uid, rows => {
      setJobs(rows);
      const operation = active.current;
      if (operation && !rows.some(row => row.id === operation.jobId && operation.matches(row))) cancel();
    });
    const stopConsent = subscribeUserCollection("consentRecords", user.uid, rows => {
      const record = rows.find(row => row.id === `${user.uid}_data_export` && row.uid === user.uid &&
        row.purpose === "data.export" && row.consentTier === "C7" && row.status === "granted");
      grantedReceipt.current = record?.receiptHash;
      if (active.current && grantedReceipt.current !== active.current.receiptHash) cancel();
    });
    const stopAuth = auth ? onAuthStateChanged(auth, current => { if (current !== user) cancel(); }) : () => {};
    return () => {
      active.current?.controller.abort();
      active.current = null;
      grantedReceipt.current = null;
      stopJobs(); stopConsent(); stopAuth();
    };
  }, [user]);

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

  async function openDownload(job: Record<string, unknown>, file: ExportFile) {
    if (active.current || auth?.currentUser !== user) return;
    const jobId = String(job.id);
    const selection: ExportSelection = { uid: user.uid, jobId, requestId: String(job.requestId ?? ""), file,
      sha256: String((file === "export" ? job.exportSha256 : job.manifestSha256) ?? "") };
    const controller = new AbortController();
    const operation = { controller, jobId, matches: (row: Record<string, unknown>) => row.uid === user.uid &&
      row.requestId === job.requestId && row.complete === true && row.status === "completed" &&
      row.consentReceiptHash === job.consentReceiptHash && row.exportSha256 === job.exportSha256 &&
      row.manifestSha256 === job.manifestSha256 && row.exportPackagePath === job.exportPackagePath && row.exportManifestPath === job.exportManifestPath,
      receiptHash: job.consentReceiptHash };
    active.current = operation;
    const current = () => active.current === operation && !controller.signal.aborted && auth?.currentUser === user;
    setDownloadBusyId(`${jobId}:${file}`);
    setMessage("");
    try {
      if (!operation.matches(job) || !selection.requestId || !/^[0-9a-f]{64}$/.test(String(job.consentReceiptHash)) ||
          grantedReceipt.current !== job.consentReceiptHash) throw new Error("Grant data export consent and request a fresh export.");
      const descriptor = await getExportDownloadUrl({ jobId, file });
      if (!current()) return;
      const blob = await fetchAuthorizedExport({ descriptor, selection, projectId: firebaseApp?.options.projectId ?? "",
        signal: controller.signal, isCurrent: current, getIdToken: () => user.getIdToken(true) });
      if (!current()) return;
      const href = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `urai-${file}.json`;
        anchor.click();
        setMessage(`${file === "export" ? "Export" : "Manifest"} downloaded.`);
      } finally { window.setTimeout(() => URL.revokeObjectURL(href), 1000); }
    } catch (error) {
      if (current()) setMessage(error instanceof Error ? error.message : "Export download failed.");
    } finally {
      if (active.current === operation) { active.current = null; setDownloadBusyId(null); }
    }
  }

  return (
    <div className="grid">
      <article className="card">
        <h3>Create request</h3>
        <p className="muted">Signed in as {user.email ?? user.uid}. Grant Data export in <a href="/privacy-center/consent">Consent settings</a> before requesting a package.</p>
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
              const complete = status === "completed" && job.complete === true;
              return (
                <li key={jobId}>
                  <strong>{status}</strong> · {String(job.exportManifestPath ?? "manifest pending")}
                  {complete ? (
                    <span>
                      <button className="button" type="button" disabled={downloadBusyId !== null} onClick={() => openDownload(job, "export")}>{downloadBusyId === `${jobId}:export` ? "Downloading..." : "Download export"}</button>
                      <button className="button" type="button" disabled={downloadBusyId !== null} onClick={() => openDownload(job, "manifest")}>{downloadBusyId === `${jobId}:manifest` ? "Downloading..." : "Download manifest"}</button>
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
