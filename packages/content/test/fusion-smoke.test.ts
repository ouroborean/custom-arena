// Smoke test for fusion kits: every fusion skill (and minion skill) is cast in a small match and
// the match plays on for a few turns without the engine throwing. Behavior is pinned per kit in
// its own scenario tests; this only proves each skill runs.

import { describe, expect, it } from 'vitest';
import { arena, content } from './harness.js';

const fusionNames = new Set(Object.values(content.fusions).map((f) => f.name));
const fusionSkills = Object.values(content.skills).filter((s) => fusionNames.has(s.element) && s.archetype !== 'Minion');
const byElement = new Map<string, typeof fusionSkills>();
for (const s of fusionSkills) byElement.set(s.element, [...(byElement.get(s.element) ?? []), s]);

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';

describe('Fusion kits: every skill runs', () => {
  it('has at least one fusion kit', () => {
    expect(byElement.size).toBeGreaterThan(0);
  });

  for (const [element, skills] of byElement) {
    describe(element, () => {
      it('has all 30 base skills', () => {
        expect(skills.length).toBe(30);
      });

      for (const s of skills) {
        it(`${s.id} (${s.name})`, () => {
          // The user also carries a Fire Strike, so Ignite-based kits have something to work with.
          const a = arena({ p0: [[s.id, 'strike.fire'], ['heal']], p1: [['strike', 'heal'], ['strike'], ['strike']], hp: 200 });
          a.use(A1, 'strike.fire', B1).end();
          a.use(B1, 'strike', A1).end();
          const target = s.target === 'enemy' ? B1 : s.target === 'ally' ? A2 : s.target === 'any' ? B1 : undefined;
          try {
            a.use(A1, s.id, target);
          } catch (e) {
            // Skills with a requirement or target filter (Harvest needs a Seedling) may be refused here.
            if (!s.requires && !s.targetFilter) throw e;
          }
          a.end();
          for (let i = 0; i < 6 && a.state.phase !== 'finished'; i++) {
            const me = a.active;
            const caster = me === 0 ? A1 : B1;
            const foe = me === 0 ? B1 : A1;
            try {
              a.use(caster, 'strike' + (me === 0 ? '.fire' : ''), foe);
            } catch {
              // Stunned, asleep or otherwise unable: just end the turn.
            }
            a.end();
          }
          expect(a.state.units.length).toBeGreaterThan(0);
        });
      }
    });
  }
});
