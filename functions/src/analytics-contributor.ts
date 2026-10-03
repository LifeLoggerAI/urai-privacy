import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";

const CHECKSUM = /^sha256:[a-f0-9]{64}$/;
const DEFAULT_TIMEOUT_MS = 10_000;

const analyticsExportResponseSchema = z.object({
  schemaVersion: z.literal("urai-analytics-data-export-v1"),
  requestId: z.string().min(1),
  userId: z.string().min(1),
  policyVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  collectionCounts: z.record(z.string(), z.number().int().nonnegative()),
  records: z.array(z.object({
    collection: z.string().min(1),
    id: z.string().min(1),
    data: z.record(z.string(), z.unknown())
  })),
  exportChecksum: z.string().regex(CHECKSUM),
  retention: z.object({
    userControlledCollections: z.array(z.string()),
    retainedOperationalCollections: z.array(z.string())
  })
}).strict();

const analyticsDeleteResponseSchema = z.object({
  schemaVersion: z.literal("urai-analytics-data-deletion-receipt-v1"),
  requestId: z.string().min(1),
  userId: z.string().min(1),
  policyVersion: z.string().min(1),
  expectedExportChecksum: z.string().regex(CHECKSUM),
  deletedAt: z.string().datetime(),
  deletedCounts: z.record(z.string(), z.number().int().nonnegative()),
  retainedOperationalCollections: z.array(z.string()),
  retainedOperationalRecordCount: z.number().int().nonnegative(),
  deletionReceiptChecksum: z.string().regex(CHECKSUM)
}).strict();

export type AnalyticsContributorConfig = {
  baseUrl: string;
  serviceId: string;
  serviceSecret: string;
  timeoutMs?: number;
};

type FetchLike = typeof fetch;

function bodyHash(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

function signature(config: AnalyticsContributorConfig, path: string, body: string, timestamp: string, nonce: string) {
  const canonical = [
    config.serviceId,
    "POST",
    path,
    timestamp,
    nonce,
    bodyHash(body)
  ].join("\n");
  return createHmac("sha256", config.serviceSecret).update(canonical).digest("hex");
}

export function analyticsContributorConfig(
  env: NodeJS.ProcessEnv = process.env
): AnalyticsContributorConfig | null {
  const baseUrl = String(env.URAI_ANALYTICS_DATA_RIGHTS_URL || "").trim();
  const serviceId = String(env.URAI_ANALYTICS_SERVICE_ID || "urai-privacy").trim();
  const serviceSecret = String(env.URAI_ANALYTICS_SERVICE_SECRET || "").trim();
  if (!baseUrl && !serviceSecret) return null;
  if (!baseUrl || !serviceSecret) throw new Error("Analytics contributor URL and service secret must be configured together.");
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(serviceId)) throw new Error("Analytics contributor service id is invalid.");
  if (serviceSecret.length < 32) throw new Error("Analytics contributor service secret is too weak.");

  const parsed = new URL(baseUrl);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Analytics contributor URL must be a credential-free HTTP origin.");
  }
  if ((env.NODE_ENV === "production" || env.GCLOUD_PROJECT) && parsed.protocol !== "https:") {
    throw new Error("Analytics contributor URL must use HTTPS outside local development.");
  }
  parsed.pathname = "/";
  return { baseUrl: parsed.origin, serviceId, serviceSecret, timeoutMs: DEFAULT_TIMEOUT_MS };
}

async function postSigned(
  config: AnalyticsContributorConfig,
  path: string,
  payload: unknown,
  fetchImpl: FetchLike
) {
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(new URL(path, config.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${signature(config, path, body, timestamp, nonce)}`,
        "x-urai-service-id": config.serviceId,
        "x-urai-timestamp": timestamp,
        "x-urai-nonce": nonce
      },
      body,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Analytics contributor request failed with HTTP ${response.status}.`);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("Analytics contributor returned invalid JSON.");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAnalyticsExport(args: {
  config: AnalyticsContributorConfig;
  requestId: string;
  uid: string;
  policyVersion: string;
  fetchImpl?: FetchLike;
}) {
  const payload = {
    requestId: args.requestId,
    userId: args.uid,
    policyVersion: args.policyVersion
  };
  const raw = await postSigned(
    args.config,
    "/api/v1/data-rights:export",
    payload,
    args.fetchImpl ?? fetch
  );
  const parsed = analyticsExportResponseSchema.parse(raw);
  if (parsed.requestId !== args.requestId || parsed.userId !== args.uid || parsed.policyVersion !== args.policyVersion) {
    throw new Error("Analytics export contributor identity does not match the request.");
  }
  return parsed;
}

export async function requestAnalyticsDelete(args: {
  config: AnalyticsContributorConfig;
  requestId: string;
  uid: string;
  policyVersion: string;
  expectedExportChecksum: string;
  legalHold: boolean;
  fetchImpl?: FetchLike;
}) {
  const payload = {
    requestId: args.requestId,
    userId: args.uid,
    policyVersion: args.policyVersion,
    legalHold: args.legalHold,
    confirmation: "DELETE_ANALYTICS_USER_DATA",
    expectedExportChecksum: args.expectedExportChecksum
  };
  const raw = await postSigned(
    args.config,
    "/api/v1/data-rights:delete",
    payload,
    args.fetchImpl ?? fetch
  );
  const parsed = analyticsDeleteResponseSchema.parse(raw);
  if (
    parsed.requestId !== args.requestId ||
    parsed.userId !== args.uid ||
    parsed.policyVersion !== args.policyVersion ||
    parsed.expectedExportChecksum !== args.expectedExportChecksum
  ) {
    throw new Error("Analytics deletion contributor receipt identity does not match the request.");
  }
  return parsed;
}
