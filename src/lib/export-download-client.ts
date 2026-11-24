export type ExportFile = "export" | "manifest";
export type ExportSelection = { uid: string; jobId: string; requestId: string; file: ExportFile; sha256: string };
const MAX_EXPORT_BYTES = 10_000_000;
const hashPattern = /^[a-f0-9]{64}$/;

function unavailable() {
  return new Error("The export is unavailable. Check your consent and request a fresh export.");
}

export async function fetchAuthorizedExport(args: {
  descriptor: Record<string, unknown>; selection: ExportSelection; projectId: string;
  emulatorOrigin?: string; signal: AbortSignal; isCurrent: () => boolean; getIdToken: () => Promise<string>;
  fetcher?: typeof fetch;
}): Promise<Blob> {
  const { descriptor: d, selection, projectId, signal } = args;
  const checkCurrent = () => {
    if (signal.aborted || !args.isCurrent() || typeof d.downloadExpiresAt !== "number" ||
        d.downloadExpiresAt <= Date.now()) throw unavailable();
  };
  checkCurrent();
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) || d.schemaVersion !== "urai-canonical-export-download-v1" ||
      d.requiresAuthorization !== true || !selection.uid || !selection.jobId || !selection.requestId ||
      d.uid !== selection.uid || d.requestId !== selection.requestId || d.jobId !== selection.jobId || d.file !== selection.file ||
      !hashPattern.test(selection.sha256) || d.sha256 !== selection.sha256 || typeof d.authorityHash !== "string" ||
      !hashPattern.test(d.authorityHash) || typeof d.auditId !== "string" || !/^[\w-]{1,160}$/.test(d.auditId) ||
      typeof d.generation !== "string" || !/^[1-9]\d*$/.test(d.generation) || !Number.isSafeInteger(Number(d.generation)) ||
      typeof d.byteLength !== "number" || !Number.isSafeInteger(d.byteLength) || d.byteLength <= 0 || d.byteLength > MAX_EXPORT_BYTES ||
      typeof d.downloadExpiresAt !== "number" || !Number.isSafeInteger(d.downloadExpiresAt) ||
      typeof d.packageExpiresAt !== "number" || !Number.isSafeInteger(d.packageExpiresAt) || d.downloadExpiresAt > d.packageExpiresAt ||
      d.downloadExpiresAt > Date.now() + 15 * 60 * 1000 || typeof d.url !== "string") throw unavailable();
  let base = `https://us-central1-${projectId}.cloudfunctions.net/downloadExportPackage`;
  if (args.emulatorOrigin !== undefined) {
    if (!/^http:\/\/(?:localhost|127\.0\.0\.1):[1-9]\d{0,4}$/.test(args.emulatorOrigin)) throw unavailable();
    base = `${args.emulatorOrigin}/${projectId}/us-central1/downloadExportPackage`;
  }
  const endpoint = new URL(d.url);
  if (endpoint.origin + endpoint.pathname !== base || endpoint.username || endpoint.password || endpoint.hash) throw unavailable();
  const fields = { jobId: selection.jobId, file: selection.file, expiresAt: String(d.downloadExpiresAt),
    authorityHash: d.authorityHash, auditId: d.auditId };
  if ([...endpoint.searchParams].length !== 5 ||
      !Object.entries(fields).every(([key, value]) => endpoint.searchParams.get(key) === value)) throw unavailable();
  const token = await args.getIdToken();
  checkCurrent();
  if (!token) throw unavailable();
  const response = await (args.fetcher ?? fetch)(endpoint, {
    method: "GET", headers: { Authorization: `Bearer ${token}` }, signal, credentials: "omit",
    cache: "no-store", redirect: "error", referrerPolicy: "no-referrer"
  });
  checkCurrent();
  if (response.status !== 200 || response.redirected || !response.body ||
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
      response.headers.get("content-length") !== String(d.byteLength)) throw unavailable();
  const bytes = new Uint8Array(d.byteLength);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      checkCurrent();
      if (chunk.done) break;
      if (chunk.value.length > bytes.length - offset) throw unavailable();
      bytes.set(chunk.value, offset);
      offset += chunk.value.length;
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (offset !== bytes.length) throw unavailable();
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  checkCurrent();
  if ([...hash].map(byte => byte.toString(16).padStart(2, "0")).join("") !== selection.sha256) throw unavailable();
  return new Blob([bytes], { type: "application/json" });
}
