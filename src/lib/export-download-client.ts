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
  const token = await args.getIdToken();
  const response = await (args.fetcher ?? fetch)(endpoint.toString(), {
    method: "GET", headers: { Authorization: `Bearer ${token}` },
    cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer"
  });
  if (!response.ok) throw new Error("The export is unavailable. Check current consent or request a new export.");
  if (!response.headers.get("content-type")?.startsWith("application/json")) {
    throw new Error("The export download did not return the expected data format.");
  }
  return response.blob();
}
