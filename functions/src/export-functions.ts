// Compatibility-only surface. The canonical export processor is export-request.ts.
// It owns scoped revocation acknowledgements, bounded processing leases,
// stale-claim recovery, deterministic pagination, and fail-closed completion.
export { processExportRequest } from "./export-request";
