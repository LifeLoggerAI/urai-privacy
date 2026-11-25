type RequestStatusProps = { request: Record<string, unknown> };

export function DeletionRequestStatus({ request }: RequestStatusProps) {
  // Historical completed records only describe the Privacy-local verifier.
  // This schema has no independently verified ecosystem-wide completion.
  const closed = request.status === "rejected" || request.status === "failed";
  const awaitingVerification = request.status === "completed" ||
    (!closed && request.deletionCompletionVerificationRequired === true);
  const label = awaitingVerification ? "verification pending" : String(request.status ?? "unknown");
  return (
    <>
      <strong>{label}</strong>
      {request.scope === "account" && request.jobsDeletionEvidenceState === "source-receipt-matched" && (
        <p className="muted">Privacy matched a Jobs processing receipt for this request. Account deletion requires verification across services.</p>
      )}
    </>
  );
}
