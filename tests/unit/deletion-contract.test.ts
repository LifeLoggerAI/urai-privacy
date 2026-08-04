import { describe, expect, it } from "vitest";
import {
  canExecuteDeletion,
  DELETION_ADAPTERS,
  DELETION_MANIFEST_VERSION,
  deletionExecutionBlockers,
  deletionManifestHash,
  deletionSubjectHash,
  nextDeletionFailureState,
  type DeletionManifest
} from "../../functions/src/deletion-contract";

function makeManifest(): DeletionManifest {
  return {
    version: DELETION_MANIFEST_VERSION,
    subjectHash: deletionSubjectHash("example-user"),
    requestId: "example-request",
    legalHold: false,
    adapters: DELETION_ADAPTERS.map((entry) => ({
      adapterId: entry.id,
      system: entry.system,
      status: entry.status,
      itemCount: entry.status === "active" ? 0 : null
    }))
  };
}

describe("deletion manifest safeguards", () => {
  it("uses a versioned manifest and opaque subject hash", () => {
    expect(DELETION_MANIFEST_VERSION).toBe("1.0.0");
    expect(deletionSubjectHash("example-user")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks while registered systems are pending", () => {
    const value = makeManifest();
    expect(canExecuteDeletion(value)).toBe(false);
    expect(deletionExecutionBlockers(value)).toContain("PENDING_ADAPTERS");
  });

  it("blocks under a legal hold", () => {
    const value = makeManifest();
    value.legalHold = true;
    value.adapters = value.adapters.map((entry) => ({
      ...entry,
      status: "active" as const
    }));
    expect(deletionExecutionBlockers(value)).toEqual(["ACTIVE_LEGAL_HOLD"]);
  });

  it("permits execution only after every adapter is active", () => {
    const value = makeManifest();
    value.adapters = value.adapters.map((entry) => ({
      ...entry,
      status: "active" as const
    }));
    expect(canExecuteDeletion(value)).toBe(true);
  });

  it("hashes the same manifest consistently", () => {
    const value = makeManifest();
    const reordered = { ...value, adapters: [...value.adapters].reverse() };
    expect(deletionManifestHash(value)).toBe(deletionManifestHash(reordered));
  });

  it("changes failure state at the configured attempt ceiling", () => {
    expect(nextDeletionFailureState(1)).toBe("retry_wait");
    expect(nextDeletionFailureState(5)).toBe("dead_letter");
  });
});
