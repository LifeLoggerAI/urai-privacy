import { describe, expect, it, vi } from "vitest";
import { fetchAuthorizedExport } from "../../src/lib/export-download-client";

const projectId = "synthetic-project";
const url = `https://us-central1-${projectId}.cloudfunctions.net/downloadExportPackage?jobId=synthetic&file=export`;

describe("authenticated export client transport", () => {
  it("sends the refreshed token only to the configured endpoint and returns private bytes without redirects or caches", async () => {
    const getIdToken = vi.fn(async () => "synthetic-id-token");
    const fetcher = vi.fn(async () => new Response('{"synthetic":true}', { headers: { "Content-Type": "application/json" } }));
    const body = await fetchAuthorizedExport({ url, projectId, getIdToken, fetcher });
    expect(await body.text()).toBe('{"synthetic":true}');
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({
      headers: { Authorization: "Bearer synthetic-id-token" }, redirect: "error", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer"
    }));
  });
  it.each([
    "https://untrusted.invalid/downloadExportPackage",
    `https://us-central1-${projectId}.cloudfunctions.net.untrusted.invalid/downloadExportPackage`,
    `http://us-central1-${projectId}.cloudfunctions.net/downloadExportPackage`,
    `https://us-central1-${projectId}.cloudfunctions.net:8443/downloadExportPackage`,
    `https://us-central1-${projectId}.cloudfunctions.net/otherFunction`,
    `https://user:password@us-central1-${projectId}.cloudfunctions.net/downloadExportPackage`
  ])("rejects untrusted endpoint %s before acquiring or transmitting a token", async (candidate) => {
    const getIdToken = vi.fn(async () => "synthetic-id-token");
    const fetcher = vi.fn();
    await expect(fetchAuthorizedExport({ url: candidate, projectId, getIdToken, fetcher })).rejects.toThrow("configured Firebase project");
    expect(getIdToken).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409, 500])("does not save the denial body returned at HTTP %s", async (status) => {
    const fetcher = vi.fn(async () => new Response('{"error":"synthetic-denial"}', { status }));
    await expect(fetchAuthorizedExport({ url, projectId, getIdToken: async () => "synthetic-id-token", fetcher })).rejects.toThrow("export is unavailable");
  });
  it("rejects an HTML deployment fallback as export content", async () => {
    const fetcher = vi.fn(async () => new Response("<html>synthetic fallback</html>", { headers: { "Content-Type": "text/html" } }));
    await expect(fetchAuthorizedExport({ url, projectId, getIdToken: async () => "synthetic-id-token", fetcher })).rejects.toThrow("expected data format");
  });
});
