export type ArtifactCleanupResult = {
  targetCount: number;
  pendingPaths: string[];
};

export async function removeExportArtifacts(
  paths: readonly string[],
  deleteArtifact: (path: string) => Promise<void>
): Promise<ArtifactCleanupResult> {
  const cleanupTargets = [...new Set(paths)];
  const pendingPaths: string[] = [];

  for (const path of [...cleanupTargets].reverse()) {
    try {
      await deleteArtifact(path);
    } catch {
      pendingPaths.push(path);
    }
  }

  return { targetCount: cleanupTargets.length, pendingPaths };
}
