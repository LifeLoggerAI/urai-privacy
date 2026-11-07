import { getStorage } from "firebase-admin/storage";
import { approvedExportCleanupGeneration } from "./export-object-generation-policy";

/**
 * Destructive storage operation. Never infer the target from current metadata.
 * The string generation-match precondition is enforced by GCS at delete time,
 * so a same-name replacement cannot be removed by a stale cleanup worker.
 */
export async function deleteApprovedExportArtifact(args: {
  uid: string;
  jobId: string;
  path: string;
  exportPath: unknown;
  manifestPath: unknown;
  exportGeneration: unknown;
  manifestGeneration: unknown;
}): Promise<void> {
  const generation = approvedExportCleanupGeneration(args);
  if (!generation) {
    throw new Error("Export cleanup denied: exact approved object generation is missing.");
  }
  await getStorage().bucket().file(args.path, {
    preconditionOpts: { ifGenerationMatch: generation }
  }).delete({ ignoreNotFound: true });
}
