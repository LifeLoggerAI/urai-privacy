import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { verifyActiveExportCaller } from "../../functions/src/export-active-caller";
const bearer = "Bearer abc.def.ghi";
describe("current export download caller", () => {
  it("requires checkRevoked and exact UID", async () => {
    let called = 0;
    expect(await verifyActiveExportCaller("owner", bearer, async (token, revoked) => {
      expect(token).toBe("abc.def.ghi"); expect(revoked).toBe(true);
      called++; return { uid: "owner" };
    })).toBe(true);
    expect(called).toBe(1);
  });
  it.each([null, "", "abc.def.ghi", "bearer abc.def.ghi", "Bearer a", "Bearer a.b.c extra", 123])("denies invalid authorization %s", async bad => {
    let called = 0;
    expect(await verifyActiveExportCaller("owner", bad, async () => { called++; return { uid: "owner" }; })).toBe(false);
    expect(called).toBe(0);
  });
  it("denies wrong UID", async () => {
    expect(await verifyActiveExportCaller("owner", bearer, async () => ({ uid: "other" }))).toBe(false);
  });
  it("denies revoked, disabled or otherwise unverified tokens", async () => {
    expect(await verifyActiveExportCaller("owner", bearer, async () => { throw Error("revoked"); })).toBe(false);
    expect(await verifyActiveExportCaller("owner", bearer, async () => ({}))).toBe(false);
  });
  it("rechecks before signing and after asynchronous audit", () => {
    const s = readFileSync(new URL("../../functions/src/export-lifecycle-functions.ts", import.meta.url), "utf8");
    const segment = s.split("export const getExportDownloadUrl = onCall(async (request) => {")[1].split("\nasync function cleanupJob(")[0];
    expect((segment.match(/await assertActiveExportRequestCaller\(request\)/g) ?? []).length).toBe(2);
    expect(segment.indexOf("await assertActiveExportRequestCaller(request)")).toBeLessThan(segment.indexOf("getSignedUrl("));
    expect(segment.lastIndexOf("await assertActiveExportRequestCaller(request)")).toBeGreaterThan(segment.indexOf("await writeAudit("));
  });
});
