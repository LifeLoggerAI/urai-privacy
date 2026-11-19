import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { isCanonicalEventTime, projectCanonicalJobsV2Revocation, revocationTransportHash } from "../../functions/src/consent-revocation-jobs-v2";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function genuineFixture() {
  const row = {
    schemaVersion: "consent.revoked.v1",
    consentRecordId: "synthetic-owner_memory_storage",
    uid: "synthetic-owner",
    purpose: "memory.storage",
    consentTier: "C1",
    policyVersion: "1.0.0",
    sourceReceiptHash: "a".repeat(64),
    priorGrantReceiptHash: "b".repeat(64),
    priorGrantEvidenceState: "present",
    revokedAt: "2026-11-19T17:47:19.123Z"
  };
  const eventId = digest({
    schemaVersion: row.schemaVersion, recordId: row.consentRecordId,
    uid: row.uid, purpose: row.purpose, consentTier: row.consentTier,
    policyVersion: row.policyVersion, receiptHash: row.sourceReceiptHash
  });
  return {
    ...row, eventId,
    integrityHash: digest({
      eventId, recordId: row.consentRecordId, uid: row.uid,
      purpose: row.purpose, priorGrantReceiptHash: row.priorGrantReceiptHash,
      priorGrantEvidenceState: row.priorGrantEvidenceState
    }),
    revocationTransportHash: revocationTransportHash({
      eventId, recordId: row.consentRecordId, uid: row.uid,
      purpose: row.purpose, policyVersion: row.policyVersion,
      sourceReceiptHash: row.sourceReceiptHash, revokedAt: row.revokedAt
    })
  };
}

describe("R1585 Jobs v2 projection of canonical Privacy revocation", () => {
  it("projects exact canonical v1 provenance to existing Jobs #501 v2 envelope without dispatch", () => {
    const row = genuineFixture();
    const projected = projectCanonicalJobsV2Revocation(row);
    expect(projected).toStrictEqual({
      type: "consent.revoked.v2", eventId: row.eventId,
      ownerUid: row.uid, purpose: row.purpose, policyVersion: row.policyVersion,
      sourceReceiptHash: row.sourceReceiptHash, correlationId: `revocation:${row.eventId}`,
      revokedAt: row.revokedAt
    });
    expect(Object.isFrozen(projected)).toBe(true);
  });
  it("does not guess historical revokedAt or generate new event identity", () => {
    const row: Record<string, unknown> = genuineFixture();
    delete row.revokedAt;
    expect(projectCanonicalJobsV2Revocation(row)).toBeNull();
    row.revokedAt = "2026-11-19T17:47:19.123Z";
    delete row.revocationTransportHash;
    expect(projectCanonicalJobsV2Revocation(row)).toBeNull();
  });
  it.each([
    ["missing", null], ["empty", ""], ["calendar rollover", "2026-02-30T14:00:00Z"],
    ["invalid date", "2026-11-19T25:00:00Z"], ["non UTC", "2026-11-19T17:47:19+00:00"],
    ["timezone-less", "2026-11-19T17:47:19"], ["bad suffix", "2026-11-19T17:47:19Zjunk"],
    ["long fraction", "2026-11-19T17:47:19.1234567890Z"]
  ])("rejects %s event time", (_label, time) => {
    expect(isCanonicalEventTime(time)).toBe(false);
  });
  it("admits precise UTC event time", () => {
    expect(isCanonicalEventTime("2026-11-19T17:47:19Z")).toBe(true);
    expect(isCanonicalEventTime("2026-11-19T17:47:19.123Z")).toBe(true);
    expect(isCanonicalEventTime("2026-11-19T17:47:19.123456789Z")).toBe(true);
  });
  it.each([
    ["empty record", {}],
    ["null", null],
    ["old outbox before R1585", (() => { const x: Record<string, unknown> = genuineFixture(); delete x.revokedAt; delete x.revocationTransportHash; return x; })()],
    ["invalid schema", {...genuineFixture(), schemaVersion: "consent.revoked.v2"}],
    ["outbox forged event identity", {...genuineFixture(), eventId: "f".repeat(64)}],
    ["changed subject", {...genuineFixture(), uid: "attacker"}],
    ["changed purpose", {...genuineFixture(), purpose: "life-movie.render"}],
    ["changed policy", {...genuineFixture(), policyVersion: "wrong"}],
    ["changed receipt", {...genuineFixture(), sourceReceiptHash: "f".repeat(64)}],
    ["changed source checksum", {...genuineFixture(), integrityHash: "f".repeat(64)}],
    ["changed transport checksum", {...genuineFixture(), revocationTransportHash: "f".repeat(64)}],
    ["bad subject", {...genuineFixture(), uid: "evil\nheader"}],
    ["bad purpose", {...genuineFixture(), purpose: "evil\nheader"}],
    ["bad timestamp", {...genuineFixture(), revokedAt: "2026-02-30T17:00:00Z"}],
    ["bad prior lineage", {...genuineFixture(), priorGrantReceiptHash: "xyz"}],
    ["false prior state", {...genuineFixture(), priorGrantEvidenceState: "verified"}],
  ])("rejects %s", (_label, fixture) => {
    expect(projectCanonicalJobsV2Revocation(fixture)).toBeNull();
  });
  it("accepts correct internally consistent missing lineage state without claiming prior grant proof", () => {
    const row = genuineFixture();
    const adapted = {
      ...row,
      priorGrantReceiptHash: null,
      priorGrantEvidenceState: "missing_or_invalid",
    };
    adapted.integrityHash = digest({
      eventId: row.eventId, recordId: row.consentRecordId, uid: row.uid,
      purpose: row.purpose, priorGrantReceiptHash: null, priorGrantEvidenceState: "missing_or_invalid"
    });
    // Source-bound status is retained, not upgraded to verified source lineage.
    expect(projectCanonicalJobsV2Revocation(adapted)?.eventId).toBe(row.eventId);
  });
});
