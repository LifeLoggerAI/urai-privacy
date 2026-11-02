import { describe, expect, it } from 'vitest';
import { matchesLifeMovieRenderScope } from '../../functions/src/consent-decision';

const requested = { projectId: 'synthetic-movie', renderPlanDigest: 'a'.repeat(64), sourceSetDigest: 'b'.repeat(64) };

describe('private Life Movie scope must be literal own-data evidence', () => {
  it('accepts a plain source scope and an own-data null-prototype scope', () => {
    expect(matchesLifeMovieRenderScope({ ...requested }, requested)).toBe(true);
    expect(matchesLifeMovieRenderScope(Object.assign(Object.create(null), requested), requested)).toBe(true);
  });
  it('rejects inherited and hidden critical scope fields', () => {
    expect(matchesLifeMovieRenderScope(Object.create(requested), requested)).toBe(false);
    expect(matchesLifeMovieRenderScope(Object.defineProperty({ ...requested }, 'extra', { value: 1 }), requested)).toBe(false);
  });
  it('rejects a matching accessor without executing a synthesized consent claim', () => {
    let reads = 0;
    const forged = { ...requested };
    Object.defineProperty(forged, 'sourceSetDigest', { enumerable: true, get() { reads++; return requested.sourceSetDigest; } });
    expect(matchesLifeMovieRenderScope(forged, requested)).toBe(false);
    expect(reads).toBe(0);
  });
  it('rejects a throwing accessor without propagating a private provider exception', () => {
    const forged = { ...requested };
    Object.defineProperty(forged, 'renderPlanDigest', { enumerable: true, get() { throw new Error('private synthetic getter'); } });
    expect(matchesLifeMovieRenderScope(forged, requested)).toBe(false);
  });
});
