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
      return response.blob();
    })();
    return await Promise.race([download, deadline]);
  } finally {
    clearTimeout(timeout);
  }
}
