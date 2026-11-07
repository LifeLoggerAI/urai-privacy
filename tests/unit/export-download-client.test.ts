import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAuthorizedExport } from "../../src/lib/export-download-client";

const projectId = "synthetic-project";
const url = `https://us-central1-${projectId}.cloudfunctions.net/downloadExportPackage?jobId=synthetic&file=export`;
afterEach(() => { vi.useRealTimers(); });

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
  it("bounds a stalled token refresh and never dispatches a token returned after timeout", async () => {
    vi.useFakeTimers();
    let refresh!: (token: string) => void;
    const getIdToken = () => new Promise<string>(resolve => { refresh = resolve; });
    const fetcher = vi.fn();
    let error: Error | undefined;
    void fetchAuthorizedExport({url, projectId, getIdToken, fetcher}).catch(caught => { error = caught; });
    await vi.advanceTimersByTimeAsync(120_001);
    expect(error?.message).toContain("timed out");
    refresh("synthetic-late-token");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts stalled response headers and releases the caller", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn((_url: string | URL | Request, options?: RequestInit) => {
      signal = options?.signal as AbortSignal;
      return new Promise<Response>(() => {});
    });
    let error: Error | undefined;
    void fetchAuthorizedExport({url, projectId, getIdToken: async () => "synthetic-token", fetcher}).catch(caught => { error = caught; });
    await vi.advanceTimersByTimeAsync(120_001);
    expect(error?.message).toContain("timed out");
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects a declared oversized export before reading it", async () => {
    const fetcher = vi.fn(async () => new Response("{}", {headers: {
      "content-type": "application/json", "content-length": String(65 * 1024 * 1024)
    }}));
    await expect(fetchAuthorizedExport({url, projectId, getIdToken: async () => "synthetic-token", fetcher}))
      .rejects.toThrow("exceeds the supported size");
  });
  it("rejects a body longer than its declared length", async () => {
    const fetcher = vi.fn(async () => new Response('{"private":true}', {headers: {
      "content-type": "application/json", "content-length": "2"
    }}));
    await expect(fetchAuthorizedExport({url, projectId, getIdToken: async () => "synthetic-token", fetcher}))
      .rejects.toThrow("exceeds the supported size");
  });
  it("rejects truncated declared responses", async () => {
    const fetcher = vi.fn(async () => new Response("{}", {headers: {
      "content-type": "application/json", "content-length": "100"
    }}));
    await expect(fetchAuthorizedExport({url, projectId, getIdToken: async () => "synthetic-token", fetcher}))
      .rejects.toThrow("incomplete");
  });
  it("uses the same deadline for unfinished private bytes and ignores late completion", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      signal = options?.signal as AbortSignal;
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true });
        },
        pull: () => new Promise<void>(() => {})
      }), {headers: {"content-type": "application/json"}});
    });
    const outcomes: unknown[] = [];
    void fetchAuthorizedExport({url, projectId, getIdToken: async () => "synthetic-token", fetcher})
      .then(result => outcomes.push(result), error => outcomes.push(error.message));
    await vi.advanceTimersByTimeAsync(120_001);
    expect(outcomes).toEqual([expect.stringContaining("timed out")]);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears the deadline after a timely download", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response('{"synthetic":true}', {headers: {"content-type": "application/json"}}));
    const blob = await fetchAuthorizedExport({url, projectId, getIdToken: async () => "synthetic-token", fetcher});
    expect(await blob.text()).toBe('{"synthetic":true}');
    expect(vi.getTimerCount()).toBe(0);
  });
});
