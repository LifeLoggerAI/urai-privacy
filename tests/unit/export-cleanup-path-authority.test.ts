import { describe, expect, it } from 'vitest';
import { inspectExportCleanupTargets as inspect } from '../../functions/src/export-cleanup-path-authority';

const exportPath = 'exports/user-123/job-123/token/export.json';
const manifestPath = 'exports/user-123/job-123/token/manifest.json';
const expected = [exportPath, manifestPath] as const;

describe('export attempt cleanup target authority', () => {
  it.each(['processing', 'completed'])('requires both expected artifacts for %s', status => {
    expect(inspect(status, [...expected], expected)).toEqual({ kind: 'cleanup', paths: [...expected] });
    expect(inspect(status, [manifestPath, exportPath], expected).kind).toBe('cleanup');
    expect(inspect(status, [], expected)).toEqual({ kind: 'blocked' });
    expect(inspect(status, [exportPath], expected)).toEqual({ kind: 'blocked' });
    expect(inspect(status, [manifestPath], expected)).toEqual({ kind: 'blocked' });
    expect(inspect(status, [exportPath, exportPath], expected)).toEqual({ kind: 'blocked' });
  });

  it.each(['artifact_cleanup', 'cleanup_pending'])('retains verified partial retries for %s', status => {
    expect(inspect(status, [manifestPath], expected)).toEqual({ kind: 'cleanup', paths: [manifestPath] });
    expect(inspect(status, [exportPath], expected)).toEqual({ kind: 'cleanup', paths: [exportPath] });
    expect(inspect(status, [], expected)).toEqual({ kind: 'blocked' });
  });

  it('recognizes a terminal already-cleaned receipt without deleting again', () => {
    expect(inspect('cleaned', [], expected)).toEqual({ kind: 'cleaned' });
    expect(inspect('cleaned', [manifestPath], expected)).toEqual({ kind: 'blocked' });
  });

  it('rejects malformed, duplicated, unexpected or absent ledger paths', () => {
    for (const paths of [null, 'export.json', {}, [null], [1], [''],
      ['exports/other/job-123/token/export.json'],
      [exportPath, 'exports/other/job-123/token/manifest.json'],
      [exportPath, manifestPath, manifestPath]]) {
      expect(inspect('completed', paths, expected)).toEqual({ kind: 'blocked' });
    }
    expect(inspect('unknown', [...expected], expected)).toEqual({ kind: 'blocked' });
    expect(inspect('completed', [...expected], [exportPath, exportPath])).toEqual({ kind: 'blocked' });
  });
});
