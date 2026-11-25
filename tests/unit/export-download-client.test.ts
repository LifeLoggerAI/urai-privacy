import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthorizedExport } from "../../src/lib/export-download-client";

const bytes = '{"sample":"public fixture"}';
const checksum = createHash("sha256").update(bytes).digest("hex");
const selection = { uid: "sample-owner", jobId: "sample-job", requestId: "sample-request", file: "export" as const, sha256: checksum };
const projectId = "demo-export-test";

function fixture() {
  const downloadExpiresAt = Date.now() + 60000;
  const authorityHash = "a".repeat(64);
  const query = new URLSearchParams({ jobId: selection.jobId, file: "export", expiresAt: String(downloadExpiresAt), authorityHash, auditId: "audit1" });
  const descriptor = { schemaVersion: "urai-canonical-export-download-v1", requiresAuthorization: true,
    ...selection, generation: "123", byteLength: bytes.length, downloadExpiresAt,
    packageExpiresAt: downloadExpiresAt + 20000, authorityHash, auditId: "audit1",
    url: `https://us-central1-${projectId}.cloudfunctions.net/downloadExportPackage?${query}` };
  const controller = new AbortController();
  const response = (body = bytes, size = bytes.length, type = "application/json") =>
    new Response(body, { headers: { "Content-Type": type, "Content-Length": String(size) } });
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response());
  const args = { descriptor, selection, projectId, signal: controller.signal, getIdToken: vi.fn(async () => "synthetic"),
    isCurrent: vi.fn(() => true), fetcher };
  return { args, fetcher, controller, response };
}

describe("authenticated export client", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("returns only the selected hash-matched local JSON and omits ambient credentials", async () => {
    const { args, fetcher } = fixture();
    expect(await (await fetchAuthorizedExport(args)).text()).toBe(bytes);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(args.descriptor.url);
    expect(init).toMatchObject({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", headers: { Authorization: "Bearer synthetic" } });
  });
  it.each([
    ["uid", "other"], ["jobId", "other"], ["requestId", "other"], ["file", "manifest"], ["requiresAuthorization", false],
    ["schemaVersion", "legacy"], ["generation", "0"], ["byteLength", 67108865], ["downloadExpiresAt", 1], ["sha256", "b".repeat(64)],
    ["url", "https://storage.googleapis.com/public-sample"], ["url","https://example.test/downloadExportPackage"]
  ])("rejects invalid %s before requesting a token", async (field, value) => {
    const { args, fetcher } = fixture();
    await expect(fetchAuthorizedExport({ ...args, descriptor: { ...args.descriptor, [field]: value } })).rejects.toThrow();
    expect(args.getIdToken).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["&jobId=other", "&irrelevant=1", "#added"])("rejects an altered query/fragment %s", async suffix => {
    const { args } = fixture(); args.descriptor.url += suffix;
    await expect(fetchAuthorizedExport(args)).rejects.toThrow();
    expect(args.getIdToken).not.toHaveBeenCalled();
  });
  it("only an explicitly selected Functions emulator may receive a token", async () => {
    const { args } = fixture();
    args.descriptor.url = args.descriptor.url.replace(`https://us-central1-${projectId}.cloudfunctions.net`, `http://127.0.0.1:5001/${projectId}/us-central1`);
    await expect(fetchAuthorizedExport(args)).rejects.toThrow();
    expect(args.getIdToken).not.toHaveBeenCalled();
    expect(await (await fetchAuthorizedExport({ ...args, emulatorOrigin: "http://127.0.0.1:5001" })).text()).toBe(bytes);
  });
  it.each(["overlong", "short", "wrong-hash", "wrong-content-length", "wrong-mime"])("discards %s payloads", async variant => {
    const { args, fetcher, response } = fixture();
    const body = variant === "overlong" ? bytes + " " : variant === "short" ? bytes.slice(1) : variant === "wrong-hash" ? "0".repeat(bytes.length) : bytes;
    fetcher.mockResolvedValueOnce(response(body, variant === "wrong-content-length" ? 1 : bytes.length, variant === "wrong-mime" ? "text/html" : "application/json"));
    await expect(fetchAuthorizedExport(args)).rejects.toThrow();
  });
  it.each(["valid", "wrong range", "wrong generation", "wrong SHA", "loses authority"])("checks each ranged response: %s", async variant => {
    const { args, fetcher, controller } = fixture();
    const total = 10000001, partSize = 4 * 1024 * 1024;
    const data = new Uint8Array(total).fill(107);
    const sha256 = createHash("sha256").update(data).digest("hex");
    const descriptor = { ...args.descriptor, byteLength: total, rangeSize: partSize, sha256 };
    let start = 0;
    fetcher.mockImplementation(async (_url, init) => {
      const end = Math.min(start + partSize, total) - 1;
      expect((init?.headers as Record<string, string>).Range).toBe(`bytes=${start}-${end}`);
      const part = data.slice(start, end + 1);
      if (variant === "wrong SHA") part[0] = 4;
      if (variant === "loses authority" && start > 0) controller.abort();
      const headers = { "Content-Type": "application/json", "Content-Length": String(part.length),
        "Content-Range": `bytes ${start}-${end}/${variant === "wrong range" ? total + 1 : total}`,
        ETag: variant === "wrong generation" ? '"other"' : '"123"' };
      start = end + 1;
      return new Response(part, { status: 206, headers });
    });
    const result = fetchAuthorizedExport({ ...args, descriptor, selection: { ...args.selection, sha256 } });
    if (variant === "valid") {
      const blob = await result;
      expect(blob.size).toBe(total);
      expect(createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex")).toBe(sha256);
      expect(args.getIdToken).toHaveBeenCalledTimes(3);
    } else { await expect(result).rejects.toThrow(); }
  });
  it("discards the pending response when the issuing session is cancelled", async () => {
    const { args, fetcher, controller, response } = fixture();
    fetcher.mockImplementationOnce(async () => { controller.abort(); return response(); });
    await expect(fetchAuthorizedExport(args)).rejects.toThrow();
  });
});
