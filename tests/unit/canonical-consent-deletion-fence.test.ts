import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkedLifeMovieDeletionState } from "../../functions/src/life-movie-deletion-fence";

const source = readFileSync(new URL("../../functions/src/consent-api.ts", import.meta.url), "utf8");

function callableSection(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("canonical consent deletion fence is verified before writes and decisions", () => {
  it("does not accept unverified deletion state in an owner consent write", () => {
    const section = callableSection(
      "export const setCanonicalConsent = onCall",
      "export const evaluateCanonicalConsent = onCall"
    );
    expect(section).toContain("transaction.get(db.collection(\"privacyDeletionTombstones\").doc(uid))");
    expect(section).toContain("if (checkedLifeMovieDeletionState(deletionFence) !== false)");
    expect(section).not.toContain("deletionFence.data()?.active === true");
  });

  it("does not accept unverified deletion state in a cross-user decision", () => {
    const section = callableSection(
      "export const evaluateCanonicalConsent = onCall",
      "const lifeMovieRenderScopeSchema ="
    );
    expect(section).toContain("transaction.get(tombstoneRef)");
    expect(section).toContain("if (checkedLifeMovieDeletionState(deletionFence) !== false)");
    expect(section).not.toContain("deletionFence.data()?.active === true");
  });

  it("permits a verified absent or inactive deletion fence", () => {
    expect(checkedLifeMovieDeletionState({ exists: false, data: () => undefined })).toBe(false);
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({ active: false }) })).toBe(false);
  });

  it("blocks an active deletion and an unverified deletion state", () => {
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({ active: true }) }) !== false).toBe(true);
    for (const snap of [
      undefined,
      null,
      { exists: true, data: () => ({}) },
      { exists: true, data: () => ({ active: "false" }) },
      { exists: true, data: () => Object.create({ active: false }) },
      { exists: true, data: () => { throw new Error("unreadable"); } }
    ]) {
      expect(checkedLifeMovieDeletionState(snap) !== false).toBe(true);
    }
  });

  it("never invokes an active getter while deciding whether deletion is clear", () => {
    let called = 0;
    const record = Object.defineProperty({}, "active", {
      get() { called++; return false; }
    });
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => record }) !== false).toBe(true);
    expect(called).toBe(0);
  });
});
