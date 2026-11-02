import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkedLifeMovieDeletionState } from "../../functions/src/life-movie-deletion-fence";

describe("transactional Life Movie deletion tombstone interpretation", () => {
  it("accepts a verified absent document without reading its data", () => {
    let called = 0;
    expect(checkedLifeMovieDeletionState({ exists: false, data: () => { called++; throw new Error("unexpected read"); } })).toBe(false);
    expect(called).toBe(0);
  });

  it("distinguishes a present inactive fence from an active deletion", () => {
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({ active: false }) })).toBe(false);
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({ active: true }) })).toBe(true);
  });

  it.each([
    ["missing snapshot", undefined],
    ["null snapshot", null],
    ["unknown existence", { data: () => ({ active: false }) }],
    ["nonboolean existence", { exists: "false", data: () => ({ active: false }) }],
    ["unreadable data", { exists: true, data: null }],
  ])("rejects %s", (_description, snapshot) => {
    expect(checkedLifeMovieDeletionState(snapshot as never)).toBeUndefined();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["missing field", {}],
    ["string false", { active: "false" }],
    ["numeric false", { active: 0 }],
    ["array", [{ active: false }]],
    ["inherited field", Object.create({ active: false })],
  ])("rejects malformed existing tombstone: %s", (_label, value) => {
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => value })).toBeUndefined();
  });

  it("never invokes a tombstone's active getter", () => {
    let getterCalls = 0;
    const value = Object.defineProperty({}, "active", {
      get() { getterCalls++; return false; }, enumerable: true
    });
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => value })).toBeUndefined();
    expect(getterCalls).toBe(0);
  });

  it("denies if a Firestore read fails rather than claiming the fence is clear", () => {
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => { throw Error("read failed"); } })).toBeUndefined();
  });

  it("keeps the verifier wired to the actual transactional tombstone snapshot", () => {
    const source = readFileSync("functions/src/consent-api.ts", "utf8");
    const start = source.indexOf("export const verifyLifeMovieRenderConsent = onCall");
    expect(start).toBeGreaterThanOrEqual(0);
    const verifier = source.slice(start);
    expect(source).toContain('import { checkedLifeMovieDeletionState } from "./life-movie-deletion-fence";');
    expect(verifier).toContain("transaction.get(tombstoneRef)");
    expect(verifier).toContain("deletionActive: checkedLifeMovieDeletionState(tombstone)");
    expect(verifier).not.toContain("tombstone.data()?.active === true");
  });
});
