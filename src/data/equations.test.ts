import { describe, expect, it } from 'vitest';
import { EQUATIONS, EQ_BY_ID, allConnections } from './equations';

describe('equation content', () => {
  it('has seventeen uniquely numbered equations', () => {
    expect(EQUATIONS).toHaveLength(17);
    expect(new Set(EQUATIONS.map((e) => e.id)).size).toBe(17);
    expect(EQUATIONS.map((e) => e.num)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
  });
  it('every equation has the full narrative and valid links', () => {
    const challengeIds = new Set<string>();
    for (const e of EQUATIONS) {
      expect(e.tex.length).toBeGreaterThan(3);
      expect(e.symbols.length).toBeGreaterThanOrEqual(3);
      expect(e.applications.length).toBeGreaterThanOrEqual(3);
      expect(e.deeper.length).toBeGreaterThanOrEqual(2);
      expect(e.challenges.length).toBeGreaterThanOrEqual(3);
      expect(e.connections.length).toBeGreaterThanOrEqual(3);
      for (const c of e.connections) expect(EQ_BY_ID[c.to], `${e.id} → ${c.to}`).toBeDefined();
      for (const c of e.challenges) {
        expect(challengeIds.has(c.id), `duplicate challenge ${c.id}`).toBe(false);
        challengeIds.add(c.id);
      }
      // inline math delimiters must be balanced so KaTeX segments parse
      for (const text of [e.plain, e.history, e.problem, e.breakthrough, e.impact, e.caveats, ...e.deeper.map((d) => d.body)])
        expect((text.match(/\$/g) ?? []).length % 2, `${e.id}: unbalanced $`).toBe(0);
    }
  });
  it('relationship map has undirected, de-duplicated links', () => {
    const links = allConnections();
    const keys = links.map((l) => [l.a, l.b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(links.length).toBeGreaterThan(25);
  });
});
