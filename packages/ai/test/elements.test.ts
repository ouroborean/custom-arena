// Every character in a match has a base element, which picks their portrait (decided 2026-10-05):
// bot teams, arcade teams and encounter characters never come without one.

import { describe, expect, it } from 'vitest';
import { seedRng } from '@arena/engine';
import { checkSinglePlayer, loadContentOrThrow } from '@arena/content';
import { arcadeDef, arcadeTeam, encounterConfig, rollableElements } from '@arena/meta';
import { availableElements, randomCharacter, randomConfig } from '../src/index.js';

const content = loadContentOrThrow();
const base = new Set(rollableElements(content));

describe('character elements', () => {
  it('random bot teams always roll a base element', () => {
    expect(availableElements(content)).not.toContain('None');
    for (let seed = 0; seed < 400; seed++) {
      for (const team of randomConfig(content, seed).teams) for (const c of team) expect(base.has(c.element!), `${seed}: ${c.element}`).toBe(true);
    }
    for (let seed = 0; seed < 200; seed++) expect(base.has(randomCharacter(content, seedRng(seed), '').element!)).toBe(true);
  });

  it('arcade teams always have base elements', () => {
    for (let stage = 1; stage <= arcadeDef(content).stages.length; stage++) {
      for (let i = 0; i < 20; i++) for (const c of arcadeTeam(content, stage, seedRng(stage * 100 + i))) expect(base.has(c.element!)).toBe(true);
    }
  });

  it('every story and tutorial character has a base element', () => {
    for (const enc of Object.values(content.encounters)) {
      const player = randomConfig(content, 1).teams[0];
      for (const team of encounterConfig(content, enc, 1, player).teams) for (const c of team) expect(base.has(c.element!), `${enc.id}: ${c.name}`).toBe(true);
    }
  });

  it('content validation rejects an encounter character without one', () => {
    const [id, enc] = Object.entries(content.encounters)[0]!;
    const { element: _dropped, ...unit } = enc.enemies[0]!;
    const broken = { ...content, encounters: { ...content.encounters, [id]: { ...enc, enemies: [unit, ...enc.enemies.slice(1)] } } };
    expect(checkSinglePlayer(broken).map((i) => i.message)).toContain('needs an element');
  });
});
