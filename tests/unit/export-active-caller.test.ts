import { describe, expect, it } from "vitest";
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
  it("accepts an unsigned Auth emulator token only when the loopback verifier is explicit", async () => {
    const calls: string[] = [];
    const verify = async (token: string, checkRevoked: boolean) => {
      expect(checkRevoked).toBe(true); calls.push(token); return { uid: "owner" };
    };
    expect(await verifyActiveExportCaller("owner", "Bearer abc.def.", verify)).toBe(false);
    expect(await verifyActiveExportCaller("owner", "Bearer abc.def.", verify, true)).toBe(true);
    expect(calls).toEqual(["abc.def."]);
  });
});
