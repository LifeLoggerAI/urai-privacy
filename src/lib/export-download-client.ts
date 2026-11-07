export async function fetchAuthorizedExport(args: {
  url: string;
  projectId: string;
  getIdToken: () => Promise<string>;
  fetcher?: typeof fetch;
}): Promise<Blob> {
  const endpoint = new URL(args.url);
  if (endpoint.protocol !== "https:"
    || endpoint.hostname !== `us-central1-${args.projectId}.cloudfunctions.net`
    || endpoint.port !== ""
    || endpoint.pathname !== "/downloadExportPackage" || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error("The export download endpoint is not the configured Firebase project.");
  }
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutMessage = "The export download timed out. Your existing export request is unchanged; try downloading again.";
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => { reject(new Error(timeoutMessage)); controller.abort(); }, 120_000);
  });
  try {
    const download = (async () => {
      const token = await args.getIdToken();
      if (controller.signal.aborted) throw new Error(timeoutMessage);
      const response = await (args.fetcher ?? fetch)(endpoint.toString(), {
        method: "GET", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer"
      });
      if (!response.ok) throw new Error("The export is unavailable. Check current consent or request a new export.");
      if (!response.headers.get("content-type")?.startsWith("application/json")) {
        throw new Error("The export download did not return the expected data format.");
      }
      // Bound private export bytes even when the upstream omits or forges Content-Length.
      const MAX_EXPORT_BYTES = 64 * 1024 * 1024;
      const declared = response.headers.get("content-length");
      if (declared !== null && (!/^[0-9]+$/.test(declared)
        || !Number.isSafeInteger(Number(declared)) || Number(declared) > MAX_EXPORT_BYTES)) {
        await response.body?.cancel();
        throw new Error("The export download exceeds the supported size.");
      }
      if (!response.body) throw new Error("The export download is unavailable.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      try {
        while (true) {
          if (controller.signal.aborted) throw new Error(timeoutMessage);
          const next = await reader.read();
          if (controller.signal.aborted) throw new Error(timeoutMessage);
          if (next.done) break;
          received += next.value.byteLength;
          if (received > MAX_EXPORT_BYTES
            || (declared !== null && received > Number(declared))) {
            throw new Error("The export download exceeds the supported size.");
          }
          chunks.push(next.value);
        }
        if (!received || (declared !== null && received !== Number(declared))) {
          throw new Error("The export download is incomplete.");
        }
        return new Blob(chunks as BlobPart[], { type: "application/json" });
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    })();
    return await Promise.race([download, deadline]);
  } finally {
    clearTimeout(timeout);
  }
}
