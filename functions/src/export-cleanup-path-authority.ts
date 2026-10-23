/**
 * A due export attempt may be a complete first cleanup, a partial retry, or an
 * already-cleaned terminal receipt. Never infer successful deletion from an
 * empty or incomplete ledger on a processing/completed export.
 */
export type ExportCleanupTargets =
  | { kind: 'blocked' }
  | { kind: 'cleaned' }
  | { kind: 'cleanup'; paths: string[] };

export function inspectExportCleanupTargets(
  status: unknown,
  paths: unknown,
  expected: readonly string[],
): ExportCleanupTargets {
  const blocked: ExportCleanupTargets = { kind: 'blocked' };
  if (!Array.isArray(expected) || expected.length !== 2 ||
    !expected.every(p => typeof p === 'string' && p.length > 0) ||
    expected[0] === expected[1] || !Array.isArray(paths) ||
    paths.some(p => typeof p !== 'string' || !expected.includes(p)) ||
    new Set(paths).size !== paths.length) return blocked;

  if (status === 'cleaned') return paths.length === 0 ? { kind: 'cleaned' } : blocked;
  if (status === 'processing' || status === 'completed') {
    if (paths.length !== 2) return blocked;
  } else if (status === 'artifact_cleanup' || status === 'cleanup_pending') {
    if (paths.length === 0) return blocked;
  } else return blocked;

  return { kind: 'cleanup', paths: [...paths] as string[] };
}
