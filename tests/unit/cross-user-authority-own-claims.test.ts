import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { crossUserAuthority } from "../../functions/src/cross-user-authority";

describe("cross-user consent authority own-claim boundary", () => {
  it("accepts owned administrator and system claims", () => {
    expect(crossUserAuthority({admin:true})).toEqual({role:"admin",consumerId:null});
    expect(crossUserAuthority({role:"admin"})).toEqual({role:"admin",consumerId:null});
    expect(crossUserAuthority({system:true,consumerId:" urai-jobs "})).toEqual({role:"system",consumerId:"urai-jobs"});
    expect(crossUserAuthority({role:"system",consumerId:"urai-jobs"})).toEqual({role:"system",consumerId:"urai-jobs"});
  });
  it("rejects inherited administrator and system privileges", () => {
    expect(crossUserAuthority(Object.create({admin:true}))).toBeNull();
    expect(crossUserAuthority(Object.create({role:"admin"}))).toBeNull();
    expect(crossUserAuthority(Object.create({role:"system",consumerId:"urai-jobs"}))).toBeNull();
    expect(crossUserAuthority(Object.assign(Object.create({system:true}),{consumerId:"urai-jobs"}))).toBeNull();
    expect(crossUserAuthority(Object.assign(Object.create({consumerId:"urai-jobs"}),{system:true}))).toBeNull();
  });
  it("rejects missing, malformed and impersonated consumers", () => {
    for (const value of ["","x","evil/name","a".repeat(121),"\u0000"]) {
      expect(crossUserAuthority({role:"system",consumerId:value})).toBeNull();
    }
    expect(crossUserAuthority({role:"user",consumerId:"urai-jobs"})).toBeNull();
  });
  it("rejects malformed claim containers", () => {
    expect(crossUserAuthority(null)).toBeNull();
    expect(crossUserAuthority(undefined)).toBeNull();
    expect(crossUserAuthority(Object.assign([],{admin:true}) as unknown as Record<string,unknown>)).toBeNull();
  });
  it("accepts own claims on a null-prototype verified record", () => {
    expect(crossUserAuthority(Object.assign(Object.create(null),{role:"system",consumerId:"urai-jobs"})))
      .toEqual({role:"system",consumerId:"urai-jobs"});
  });
  it("never evaluates an inherited privileged getter", () => {
    let calls=0;
    const inherited=Object.create(Object.defineProperty({},"role",{get(){calls++;return "admin";}}));
    expect(crossUserAuthority(inherited)).toBeNull();
    expect(calls).toBe(0);
  });
  it("routes real Privacy admin and owner-or-admin decisions through canonical own claims", () => {
    const source = readFileSync(new URL("../../functions/src/index.ts", import.meta.url), "utf8");
    expect(source).toContain('import { crossUserAuthority } from "./cross-user-authority";');
    expect(source).toMatch(/function isAdmin\(token\?: Record<string, unknown>\) \{\s*return crossUserAuthority\(token\)\?\.role === "admin";\s*\}/);
    expect(source).toContain('if (!isAdmin(request.auth?.token))');
    expect(source).toContain('if (uid !== targetUid && !isAdmin(request.auth?.token))');
  });
});
