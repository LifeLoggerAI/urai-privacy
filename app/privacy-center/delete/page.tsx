"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AuthGate } from "@/components/AuthGate";
import { createDeletionRequest, subscribeUserCollection } from "@/lib/firebase-privacy-client";

function deletionStatusLabel(request: Record<string, unknown>) {
  if (
    request.deletionCompletionVerificationRequired === true &&
    request.deletionCompletionVerified !== true
  ) {
    return "verification pending";
  }
  return String(request.status ?? "unknown");
}

export default function DeletePage() {
  return (
    <section>
      <div className="eyebrow">Deletion request</div>
      <h1>Request account or privacy-data deletion</h1>
      <p className="lede">Deletion requests are submitted through the authenticated Firebase callable workflow. Destructive erasure is never shown as complete until the residual Firestore, Storage, Auth, and legal-hold verifier records final completion.</p>
      <AuthGate>{(user) => <DeletionRequestPanel user={user} />}</AuthGate>
    </section>
  );
}

function DeletionRequestPanel({ user }: { user: User }) {
  const [reason, setReason] = useState("User requested account/data deletion");
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeUserCollection("deletionRequests", user.uid, setRequests), [user.uid]);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const result = await createDeletionRequest(reason);
      setMessage(`Deletion request created: ${String(result.requestId ?? "unknown")}. This records and queues the request; it is not a claim that destructive deletion has already completed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deletion request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <article className="card">
        <h3>Create deletion request</h3>
        <p className="muted">This creates an auditable deletion request. Final completion requires a successful post-mutation residual verification record.</p>
        <label htmlFor="reason">Reason</label>
        <textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <button className="button primary" type="button" disabled={busy || reason.trim().length < 8} onClick={submit}>{busy ? "Submitting..." : "Request deletion"}</button>
        {message ? <p className="muted" aria-live="polite">{message}</p> : null}
      </article>
      <article className="card">
        <h3>Your deletion requests</h3>
        <p className="muted">Signed in as {user.email ?? user.uid}. Requests are user-scoped by Firestore rules.</p>
        {requests.length === 0 ? <p className="muted">No deletion requests found.</p> : (
          <ul>
            {requests.map((request) => {
              const verificationPending = request.deletionCompletionVerificationRequired === true && request.deletionCompletionVerified !== true;
              return (
                <li key={String(request.id)}>
                  <strong>{deletionStatusLabel(request)}</strong> · {String(request.scope ?? "account")}
                  {request.destructiveDeletionBlocked ? <span className="status warn">destructive deletion gated</span> : null}
                  {verificationPending ? <span className="status warn">residual verification required</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}
