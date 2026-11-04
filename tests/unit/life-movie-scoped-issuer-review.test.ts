import { describe, expect, it } from "vitest";
import {
  writeReviewOnlyScopedGrantCandidate,
  type ReviewOnlyMovieGrantBackend,
  type ReviewOnlyMovieGrantTransaction,
} from "../../functions/src/life-movie-scoped-issuer-review";

const time = Date.parse("2026-11-03T18:00:00.000Z");
const when = (ms: number) => new Date(time + ms).toISOString();
const scope = Object.freeze({
  projectId: "movie-1", renderPlanDigest: "a".repeat(64), sourceSetDigest: "b".repeat(64)
});
const notice = {
  reviewEventId: "notice-event-1", noticeVersion: "notice-v1",
  noticeHash: "c".repeat(64), policyVersion: "1.1.0", surface: "movie-selection" as const,
  jurisdiction: "US"
};
const approval = {
  eventId: "approval-event-1", actorUid: "owner-1", ownerUid: "owner-1", tenantId: "tenant-1",
  purpose: "life-movie.render" as const, status: "granted" as const,
  noticeVersion: notice.noticeVersion, noticeHash: notice.noticeHash,
  renderScope: scope, approvedAt: when(-5000), expiresAt: when(3600000)
};
const selection = {
  eventId: "selection-event-1", ownerUid: "owner-1", tenantId: "tenant-1",
  renderScope: scope, verifiedAt: when(-5000)
};
const rights = {
  rightsEventId: "rights-event-1", ownerUid: "owner-1", tenantId: "tenant-1",
  renderScope: scope, verifiedAt: when(-5000)
};
const request = {
  ownerUid: "owner-1", tenantId: "tenant-1",
  noticeReviewEventId: notice.reviewEventId, approvalEventId: approval.eventId,
  selectionEventId: selection.eventId, rightsEventId: rights.rightsEventId
};

type FixtureOptions = {
  actor?: string;
  profile?: unknown;
  tombstone?: unknown;
  existing?: unknown;
  notice?: unknown;
  approval?: unknown;
  selection?: unknown;
  rights?: unknown;
  now?: number;
  throwAudit?: boolean;
  throwGrant?: boolean;
};

function fixture(overrides: FixtureOptions = {}) {
  const pending: Array<{ type: string; data: Record<string, unknown> }> = [];
  let transactions = 0;
  const transactionsCommitted: Array<typeof pending> = [];
  const tx: ReviewOnlyMovieGrantTransaction = {
    readOwnerProfile: async () => overrides.profile === undefined
      ? { uid: "owner-1", tenantId: "tenant-1", accountStatus: "active", deleted: false, markedForDeletion: false }
      : overrides.profile,
    readDeletionTombstone: async () => overrides.tombstone === undefined
      ? { exists: false, data: () => undefined }
      : overrides.tombstone as any,
    readExistingGrant: async () => overrides.existing === undefined ? null : overrides.existing,
    readReviewedNotice: async () => overrides.notice === undefined ? notice : overrides.notice,
    readOwnerApproval: async () => overrides.approval === undefined ? approval : overrides.approval,
    readVerifiedSelection: async () => overrides.selection === undefined ? selection : overrides.selection,
    readVerifiedSourceRights: async () => overrides.rights === undefined ? rights : overrides.rights,
    createGrant: (_recordId, record) => {
      if (overrides.throwGrant) throw Error("backend grant write failed");
      pending.push({ type: "grant", data: record as Record<string, unknown> });
    },
    createAudit: (_eventId, record) => {
      if (overrides.throwAudit) throw Error("backend audit write failed");
      pending.push({ type: "audit", data: record as Record<string, unknown> });
    },
  };
  const backend: ReviewOnlyMovieGrantBackend = {
    verifiedActiveOwnerUid: async () => overrides.actor ?? "owner-1",
    nowMs: () => overrides.now ?? time,
    runTransaction: async (fn) => {
      transactions++;
      try {
        const result = await fn(tx);
        transactionsCommitted.push([...pending]);
        return result;
      } catch (error) {
        pending.length = 0;
        throw error;
      }
    },
  };
  return { backend, getCommitted: () => transactionsCommitted, getTransactions: () => transactions };
}

describe("review-only movie grant issuer transaction seam (NOT a deployable issuer)", () => {
  it("allows a matching synthetic candidate only in an isolated fake atomic transaction", async () => {
    const data = fixture();
    const out = await writeReviewOnlyScopedGrantCandidate(request, data.backend);
    expect(out.recordId).toBe("owner-1_life-movie_render");
    expect(out.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.auditEventId).toBeTruthy();
    const committed = data.getCommitted();
    expect(committed).toHaveLength(1);
    expect(committed[0].map(x => x.type)).toEqual(["grant", "audit"]);
    expect(committed[0][0].data.receiptHash).toBe(out.receiptHash);
    expect(committed[0][1].data.productionAuthorized).toBe(false);
    expect(committed[0][1].data.issuerApproved).toBe(false);
  });

  it.each([
    ["wrong signed-in owner", { actor: "foreign-owner" }],
    ["inactive owner", { profile: { uid: "owner-1", tenantId: "tenant-1", accountStatus: "disabled", deleted: false, markedForDeletion: false } }],
    ["foreign tenant profile", { profile: { uid: "owner-1", tenantId: "tenant-2", accountStatus: "active", deleted: false, markedForDeletion: false } }],
    ["missing deletion evidence", { tombstone: null }],
    ["active deletion", { tombstone: { exists: true, data: () => ({ active: true }) } }],
    ["malformed deletion", { tombstone: { exists: true, data: () => ({}) } }],
    ["existing prior grant", { existing: { status: "revoked" } }],
    ["existing prior denial", { existing: { status: "denied" } }],
    ["wrong notice record", { notice: { ...notice, reviewEventId: "notice-other" } }],
    ["stale owner approval", { approval: { ...approval, approvedAt: when(-500000) } }],
    ["future source rights evidence", { rights: { ...rights, verifiedAt: when(2000) } }],
    ["wrong source rights digest", { rights: { ...rights, renderScope: { ...scope, sourceSetDigest: "f".repeat(64) } } }],
    ["wrong selection identity", { selection: { ...selection, ownerUid: "another-user" } }],
    ["audit persistence failure", { throwAudit: true }],
    ["grant persistence failure", { throwGrant: true }],
  ])("fails closed on %s and rolls back candidate writes", async (_label, options) => {
    const data = fixture(options);
    await expect(writeReviewOnlyScopedGrantCandidate(request, data.backend))
      .rejects.toThrow("life_movie_review_only_issuer_evidence_unverified");
    expect(data.getCommitted()).toEqual([]);
  });

  it("rejects caller-supplied extra authority fields before any transaction", async () => {
    const data = fixture();
    await expect(writeReviewOnlyScopedGrantCandidate({
      ...request, system: true, consentGranted: true
    }, data.backend)).rejects.toThrow("life_movie_review_only_issuer_evidence_unverified");
    expect(data.getTransactions()).toBe(0);
  });

  it("does not execute getter-backed request authority", async () => {
    let calls = 0;
    const data = fixture();
    const forged = { ...request };
    Object.defineProperty(forged, "ownerUid", {
      enumerable: true, get() { calls++; return "owner-1"; }
    });
    await expect(writeReviewOnlyScopedGrantCandidate(forged, data.backend))
      .rejects.toThrow("life_movie_review_only_issuer_evidence_unverified");
    expect(calls).toBe(0);
    expect(data.getTransactions()).toBe(0);
  });

  it("requires explicit transaction and trusted owner identity interfaces", async () => {
    await expect(writeReviewOnlyScopedGrantCandidate(request, {
      nowMs: () => time
    } as ReviewOnlyMovieGrantBackend)).rejects.toThrow("life_movie_review_only_issuer_evidence_unverified");
  });
});
