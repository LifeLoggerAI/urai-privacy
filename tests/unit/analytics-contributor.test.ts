import { describe, expect, it } from "vitest";
import {
  analyticsContributorConfig,
  requestAnalyticsDelete,
  requestAnalyticsExport
} from "../../functions/src/analytics-contributor";

const config = {
  baseUrl: "http://127.0.0.1:3000",
  serviceId: "urai-privacy",
  serviceSecret: "a".repeat(48),
  timeoutMs: 1000
};

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("Analytics privacy contributor adapter", () => {
  it("fails closed on partial or weak configuration", () => {
    expect(analyticsContributorConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(() => analyticsContributorConfig({
      URAI_ANALYTICS_DATA_RIGHTS_URL: "https://analytics.example.test"
    } as NodeJS.ProcessEnv)).toThrow("configured together");
    expect(() => analyticsContributorConfig({
      URAI_ANALYTICS_DATA_RIGHTS_URL: "https://analytics.example.test",
      URAI_ANALYTICS_SERVICE_SECRET: "weak"
    } as NodeJS.ProcessEnv)).toThrow("too weak");
  });

  it("signs export requests and validates exact contributor identity", async () => {
    const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(input)).toBe("http://127.0.0.1:3000/api/v1/data-rights:export");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toMatch(/^Bearer [a-f0-9]{64}$/);
      expect(headers.get("x-urai-service-id")).toBe("urai-privacy");
      expect(headers.get("x-urai-timestamp")).toMatch(/Z$/);
      expect(headers.get("x-urai-nonce")).toBeTruthy();
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        requestId: "privacy-request-analytics-0001",
        userId: "analytics-user-0001",
        policyVersion: "urai-privacy-export-v1"
      });
      return response({
        schemaVersion: "urai-analytics-data-export-v1",
        requestId: body.requestId,
        userId: body.userId,
        policyVersion: body.policyVersion,
        generatedAt: "2026-10-03T00:00:00.000Z",
        collectionCounts: { passiveSignals: 1 },
        records: [{ collection: "passiveSignals", id: "s1", data: { userId: body.userId } }],
        exportChecksum: "sha256:" + "a".repeat(64),
        retention: { userControlledCollections: ["passiveSignals"], retainedOperationalCollections: ["auditLogs"] }
      });
    }) as typeof fetch;

    const result = await requestAnalyticsExport({
      config,
      requestId: "privacy-request-analytics-0001",
      uid: "analytics-user-0001",
      policyVersion: "urai-privacy-export-v1",
      fetchImpl
    });
    expect(result.exportChecksum).toBe("sha256:" + "a".repeat(64));
    expect(result.records).toHaveLength(1);
  });

  it("validates deletion receipts against the exact export checksum", async () => {
    const exportChecksum = "sha256:" + "b".repeat(64);
    const fetchImpl = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const body = JSON.parse(String(init?.body));
      expect(body.confirmation).toBe("DELETE_ANALYTICS_USER_DATA");
      expect(body.expectedExportChecksum).toBe(exportChecksum);
      return response({
        schemaVersion: "urai-analytics-data-deletion-receipt-v1",
        requestId: body.requestId,
        userId: body.userId,
        policyVersion: body.policyVersion,
        expectedExportChecksum: body.expectedExportChecksum,
        deletedAt: "2026-10-03T00:10:00.000Z",
        deletedCounts: { passiveSignals: 1 },
        retainedOperationalCollections: ["auditLogs"],
        retainedOperationalRecordCount: 1,
        deletionReceiptChecksum: "sha256:" + "c".repeat(64)
      });
    }) as typeof fetch;

    const result = await requestAnalyticsDelete({
      config,
      requestId: "privacy-request-analytics-0001",
      uid: "analytics-user-0001",
      policyVersion: "urai-privacy-delete-v1",
      expectedExportChecksum: exportChecksum,
      legalHold: false,
      fetchImpl
    });
    expect(result.deletionReceiptChecksum).toBe("sha256:" + "c".repeat(64));
  });
});
