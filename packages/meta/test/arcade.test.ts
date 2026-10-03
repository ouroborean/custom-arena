// Arcade mode (decided 2026-10-03): a ladder of bot teams that starts with 2-skill, uninfused enemies;
// with each stage they alternately gain skills and infusions, their infusions grow cohesive, then
// double-element skills arrive, and last the enemies' elements overlap partially, then completely.

import { describe, expect, it } from 'vitest';
import { createMatch, seedRng, type CharacterSpec } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { arcadeDef, arcadeNextStage, arcadeReward, arcadeTeam, rollableClasses, rollableElements } from '../src/index.js';

const content = loadContentOrThrow();
const def = arcadeDef(content);
const fusionElements = new Map(Object.values(content.fusions).map((f) => [f.name, f.elements as readonly string[]]));
const baseElements = new Set(rollableElements(content));
const starters = new Map(rollableClasses(content).map((c) => [c.id, c.starter]));

/** The infusions on one skill: none, its element, or a fusion's two. */
function infusionsOf(skillId: string): string[] {
  const el = content.skills[skillId]!.element;
  if (el === 'None') return [];
  return fusionElements.has(el) ? [...fusionElements.get(el)!] : [el];
}
const infusions = (c: CharacterSpec) => c.skills.flatMap(infusionsOf);
const doubles = (c: CharacterSpec) => c.skills.filter((s) => infusionsOf(s).length === 2);
const teams = (stage: number, n = 60) => Array.from({ length: n }, (_, i) => arcadeTeam(content, stage, seedRng(1000 * stage + i)));

describe('the arcade curve', () => {
  it('starts with 2 skills and no infusions', () => {
    expect(def.stages[0]).toMatchObject({ skills: 2, infusions: 0 });
    for (const team of teams(1)) {
      for (const c of team) {
        expect(c.skills).toHaveLength(2);
        expect(infusions(c)).toEqual([]);
        expect(c.skills[0]).toBe(starters.get(c.classId!)); // the class's starter skill comes first
      }
    }
  });

  it('gains skills and infusions in turn, one or the other each stage', () => {
    let growingSkills = 0;
    for (let i = 1; i < def.stages.length; i++) {
      const [a, b] = [def.stages[i - 1]!, def.stages[i]!];
      expect(b.skills).toBeGreaterThanOrEqual(a.skills);
      expect(b.infusions).toBeGreaterThanOrEqual(a.infusions);
      const grew = [b.skills > a.skills, b.infusions > a.infusions];
      expect(grew.filter(Boolean)).toHaveLength(1);
      // Until the kits are full, a skill stage is followed by an infusion stage and vice versa.
      if (b.skills > a.skills) growingSkills = i;
      else if (a.skills < 5 && i > 1) expect(growingSkills).toBe(i - 1);
    }
  });

  it('every stage builds teams of exactly its shape, which start a match', () => {
    def.stages.forEach((s, i) => {
      for (const team of teams(i + 1, 30)) {
        expect(new Set(team.map((c) => c.classId)).size).toBe(3);
        for (const c of team) {
          expect(c.skills).toHaveLength(s.skills);
          expect(infusions(c)).toHaveLength(s.infusions);
          expect(doubles(c)).toHaveLength(s.doubles);
          expect(baseElements.has(c.element!)).toBe(true);
        }
        expect(() => createMatch(content, { seed: 1, teams: [team, team] })).not.toThrow();
      }
    });
  });

  it('is deterministic for a seed', () => {
    expect(arcadeTeam(content, 7, seedRng(5))).toEqual(arcadeTeam(content, 7, seedRng(5)));
  });

  it('infusions start out random and become cohesive: the enemy’s own element', () => {
    const random = def.stages.findIndex((s) => s.infusions >= 1 && s.cohesion === 0) + 1;
    const cohesive = def.stages.findIndex((s) => s.cohesion === 1) + 1;
    expect(random).toBeGreaterThan(0);
    expect(cohesive).toBeGreaterThan(random);
    // Random infusions are often not the enemy's element...
    const strays = teams(random, 100).flat().filter((c) => infusions(c).some((e) => e !== c.element)).length;
    expect(strays).toBeGreaterThan(150);
    // ...cohesive ones (before double skills) always are.
    for (const c of teams(cohesive, 100).flat()) for (const e of infusions(c)) expect(e).toBe(c.element);
  });

  it('then come double-element skills, each with the enemy’s own element', () => {
    const first = def.stages.findIndex((s) => s.doubles > 0);
    expect(first).toBeGreaterThan(def.stages.findIndex((s) => s.cohesion === 1));
    for (const c of teams(first + 1).flat()) for (const s of doubles(c)) expect(infusionsOf(s)).toContain(c.element);
  });

  it('then the enemies’ elements overlap partially: each one’s second element is the next one’s first', () => {
    const stage = def.stages.findIndex((s) => s.overlap === 'partial') + 1;
    expect(stage).toBeGreaterThan(def.stages.findIndex((s) => s.doubles > 0) + 1);
    for (const team of teams(stage)) {
      expect(new Set(team.map((c) => c.element)).size).toBe(3);
      team.forEach((c, i) => {
        const next = team[(i + 1) % 3]!.element!;
        for (const e of infusions(c)) expect([c.element, next]).toContain(e);
        for (const s of doubles(c)) expect(infusionsOf(s).sort()).toEqual([c.element!, next].sort());
      });
    }
  });

  it('and finally completely: all three share both elements', () => {
    const last = def.stages[def.stages.length - 1]!;
    expect(last.overlap).toBe('full');
    for (const team of teams(def.stages.length)) {
      const shared = new Set(team.flatMap(infusions));
      expect(shared.size).toBe(2);
      expect(new Set(team.map((c) => c.element)).size).toBe(1);
      expect(new Set(team.flatMap(doubles).map((s) => content.skills[s]!.element)).size).toBe(1);
    }
  });
});

describe('arcade runs and rewards', () => {
  const last = def.stages.length;

  it('a win moves to the next stage; a loss or draw, or clearing the ladder, starts over', () => {
    expect(arcadeNextStage(content, undefined)).toBe(1);
    expect(arcadeNextStage(content, { stage: 3, outcome: 'win' })).toBe(4);
    expect(arcadeNextStage(content, { stage: 3, outcome: 'loss' })).toBe(1);
    expect(arcadeNextStage(content, { stage: 3, outcome: 'draw' })).toBe(1);
    expect(arcadeNextStage(content, { stage: last, outcome: 'win' })).toBe(1);
  });

  it('every stage cleared pays its reward in full, its drops never left to chance', () => {
    for (let stage = 1; stage <= last; stage++) {
      const s = def.stages[stage - 1]!;
      expect(s.win.drops?.chance ?? 1).toBe(1);
      const r = arcadeReward(content, { stage, outcome: 'win', endReason: 'elimination', dropsToday: 0 }, seedRng(stage));
      const bonus = stage === last ? def.complete : { currency: {}, drops: undefined };
      expect(r.currency.gold).toBe((s.win.currency?.gold ?? 0) + (bonus.currency?.gold ?? 0));
      expect(r.items).toHaveLength((s.win.drops?.count ?? 0) + (bonus.drops?.count ?? 0));
    }
  });

  it('a played-out loss pays the consolation; a surrender pays nothing', () => {
    expect(arcadeReward(content, { stage: 4, outcome: 'loss', endReason: 'elimination', dropsToday: 0 }, seedRng(1)).currency).toEqual(def.loss.currency);
    expect(arcadeReward(content, { stage: 4, outcome: 'loss', endReason: 'surrender', dropsToday: 0 }, seedRng(1))).toEqual({ currency: {}, items: [] });
  });

  it('drops stop at the arcade’s own daily cap', () => {
    const r = arcadeReward(content, { stage: last, outcome: 'win', endReason: 'elimination', dropsToday: def.dailyDropCap - 1 }, seedRng(1));
    expect(r.items).toHaveLength(1);
    expect(arcadeReward(content, { stage: 1, outcome: 'win', endReason: 'elimination', dropsToday: def.dailyDropCap }, seedRng(1)).items).toEqual([]);
  });
});
