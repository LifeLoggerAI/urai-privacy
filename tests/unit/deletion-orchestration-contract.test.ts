import { describe, expect, it } from "vitest";
import {
  DEFAULT_REQUIRED_DOWNSTREAM_SYSTEMS,
  DELETION_EXECUTION_STALE_MS,
  deletionCompletionStatus,
  deletionPlanHash,
  isStaleProcessingExecution,
  normalizeRequiredDownstreamSystems,
  PRIMARY_DELETION_ADAPTERS
} from "../../functions/src/deletion-contract";

describe("deletion orchestration contract", () => {
  it("requires primary Firestore, Storage, and Auth verification", () => {
    expect(PRIMARY_DELETION_ADAPTERS).toEqual([
      "firestore-primary",
      "storage-user-prefixes",
      "firebase-auth"
    ]);
  });

  it("requires downstream URAI acknowledgements by default in production", () => {
    expect(normalizeRequiredDownstreamSystems(undefined, true)).toEqual([
      ...DEFAULT_REQUIRED_DOWNSTREAM_SYSTEMS
    ]);
  });

  it("does not permit production to disable downstream acknowledgements", () => {
    expect(() => normalizeRequiredDownstreamSystems("none", true)).toThrow(
      "Production deletion cannot disable downstream acknowledgements"
    );
    expect(() => normalizeRequiredDownstreamSystems("urai-spatial,none", true)).toThrow(
      "Production deletion cannot disable downstream acknowledgements"
    );
  });

  it("allows explicit none only outside production", () => {
    expect(normalizeRequiredDownstreamSystems("none,urai-spatial", false)).toEqual([]);
  });

  it("normalizes and deduplicates configured downstream systems", () => {
    expect(normalizeRequiredDownstreamSystems("urai-jobs, urai-spatial,urai-jobs", true)).toEqual([
      "urai-jobs",
      "urai-spatial"
    ]);
  });

  it("marks only expired processing executions as stale", () => {
    const now = Date.parse("2026-07-06T12:00:00.000Z");
    expect(isStaleProcessingExecution({
      status: "processing",
      startedAt: new Date(now - DELETION_EXECUTION_STALE_MS - 1).toISOString()
    }, now)).toBe(true);
    expect(isStaleProcessingExecution({
      status: "processing",
      startedAt: new Date(now - DELETION_EXECUTION_STALE_MS + 1).toISOString()
    }, now)).toBe(false);
    expect(isStaleProcessingExecution({ status: "failed" }, now)).toBe(false);
    expect(isStaleProcessingExecution({ status: "processing" }, now)).toBe(false);
  });

  it("supports Firestore-like timestamps when checking staleness", () => {
    const now = Date.parse("2026-07-06T12:00:00.000Z");
    expect(isStaleProcessingExecution({
      status: "processing",
      startedAt: { toMillis: () => now - DELETION_EXECUTION_STALE_MS - 1 }
    }, now)).toBe(true);
  });

  it("produces a deterministic plan hash regardless of object insertion order", () => {
    const base = {
      uid: "user-a",
      requestId: "request-a",
      legalHold: false,
      authAccountExists: true,
      requiredDownstreamSystems: ["urai-spatial", "urai-jobs"]
    };
    const first = deletionPlanHash({
      ...base,
      firestoreCounts: { users: 1, exportJobs: 2 },
      storageCounts: { "exports/user-a/": 3, "users/user-a/": 1 }
    });
    const second = deletionPlanHash({
      ...base,
      firestoreCounts: { exportJobs: 2, users: 1 },
      storageCounts: { "users/user-a/": 1, "exports/user-a/": 3 },
      requiredDownstreamSystems: ["urai-jobs", "urai-spatial"]
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("never reports completion while downstream acknowledgements are pending", () => {
    expect(deletionCompletionStatus({
      primaryStoresVerified: true,
      downstreamPending: ["urai-spatial"]
    })).toBe("primary_stores_verified_downstream_pending");
    expect(deletionCompletionStatus({
      primaryStoresVerified: true,
      downstreamPending: []
    })).toBe("completed");
    expect(deletionCompletionStatus({
      primaryStoresVerified: false,
      downstreamPending: []
    })).toBe("failed");
  });
});
