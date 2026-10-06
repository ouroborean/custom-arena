// Player levels and loot boxes (decided 2026-10-05): matches pay experience; the bar has a bubble at 25,
// 50, 75 and 100% and each pays a loot box (uncommon at 25 and 75%, rare at 50%, epic at 100%, the
// level-up). A box holds three rolls: the lowest pays gold, mid rolls tier 1–2 gear (by the box's
// quality), a high roll a random tier-3 piece. Tiers count components (forged pieces of 2 or 3).

import { describe, expect, it } from 'vitest';
import { describePiece, pieceComponentIds, seedRng } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { levelOf, matchXp, milestonesBetween, openLootBox, randomForgedPiece, xpForLevel, xpGain, type LootRoll } from '../src/index.js';

const content = loadContentOrThrow();
const progression = content.economy.progression!;
const boxes = content.economy.lootBoxes!;

describe('the experience bar', () => {
  it('has bubbles at 25, 50, 75 and 100%: uncommon, rare, uncommon, epic', () => {
    expect(progression.milestones).toEqual([
      { at: 25, box: 'uncommon' },
      { at: 50, box: 'rare' },
      { at: 75, box: 'uncommon' },
      { at: 100, box: 'epic' },
    ]);
  });

  it('levels take more experience as they rise, up to a cap', () => {
    expect(xpForLevel(content, 2)).toBeGreaterThan(xpForLevel(content, 1));
    expect(xpForLevel(content, 100)).toBe(progression.levels.max);
  });

  it('turns total experience into a level and progress within it', () => {
    const first = xpForLevel(content, 1);
    expect(levelOf(content, 0)).toMatchObject({ level: 1, xp: 0, needed: first });
    expect(levelOf(content, first - 1)).toMatchObject({ level: 1, xp: first - 1 });
    expect(levelOf(content, first)).toMatchObject({ level: 2, xp: 0, needed: xpForLevel(content, 2) });
  });

  it('pays each bubble once, as it is reached', () => {
    const n = xpForLevel(content, 1);
    expect(milestonesBetween(content, 0, n / 4 - 1)).toEqual([]);
    expect(milestonesBetween(content, 0, n / 4).map((m) => m.box)).toEqual(['uncommon']);
    expect(milestonesBetween(content, n / 4, n / 2).map((m) => m.box)).toEqual(['rare']);
    expect(milestonesBetween(content, n / 2, n).map((m) => m.box)).toEqual(['uncommon', 'epic']);
    // A big jump across a level boundary pays every bubble on the way, in order.
    const across = milestonesBetween(content, n - 1, n + xpForLevel(content, 2) / 2);
    expect(across.map((m) => [m.level, m.at])).toEqual([
      [1, 100],
      [2, 25],
      [2, 50],
    ]);
  });

  it('reports a match’s gain: experience, level-ups and boxes', () => {
    const n = xpForLevel(content, 1);
    const g = xpGain(content, n - 10, 20);
    expect(g).toMatchObject({ gained: 20, levelsGained: 1, boxes: ['epic'] });
    expect(g.after).toMatchObject({ level: 2, xp: 10 });
  });
});

describe('experience from matches', () => {
  it('pays more for a win than a loss', () => {
    for (const kind of ['casual', 'ranked', 'practice', 'arcade', 'story']) {
      const win = matchXp(content, { kind, outcome: 'win', endReason: 'victory', turns: 20 });
      const loss = matchXp(content, { kind, outcome: 'loss', endReason: 'victory', turns: 20 });
      expect(win).toBeGreaterThan(loss);
      expect(loss).toBeGreaterThan(0);
    }
  });

  it('pays nothing for private matches, forfeited losses or short matches', () => {
    expect(matchXp(content, { kind: 'private', outcome: 'win', endReason: 'victory', turns: 20 })).toBe(0);
    expect(matchXp(content, { kind: 'casual', outcome: 'loss', endReason: 'surrender', turns: 20 })).toBe(0);
    expect(matchXp(content, { kind: 'casual', outcome: 'win', endReason: 'surrender', turns: 20 })).toBeGreaterThan(0);
    expect(matchXp(content, { kind: 'casual', outcome: 'win', endReason: 'victory', turns: 2 })).toBe(0);
  });
});

/** Rolls `n` boxes of a kind and tallies the rolls. */
function sample(box: string, n = 3000) {
  const rolls: LootRoll[] = [];
  for (let i = 0; i < n; i++) rolls.push(...openLootBox(content, box, seedRng(i * 7919 + 13)));
  const share = (f: (r: LootRoll) => boolean) => rolls.filter(f).length / rolls.length;
  return {
    rolls,
    gold: share((r) => r.kind === 'gold'),
    tier: (t: number) => share((r) => r.kind === 'gear' && r.tier === t),
  };
}

// The statistical tests roll thousands of boxes: give them room under a loaded full-suite run.
const SAMPLING = 30_000;

describe('loot boxes', () => {
  it('hold three rolls, lowest first', () => {
    for (const box of Object.keys(boxes)) {
      for (let i = 0; i < 50; i++) {
        const rolls = openLootBox(content, box, seedRng(i));
        expect(rolls).toHaveLength(3);
        const rank = rolls.map((r) => (r.kind === 'gold' ? 0 : r.tier));
        expect(rank).toEqual([...rank].sort((a, b) => a - b));
      }
    }
  });

  it('pay gold on a low roll, and gear of the tier rolled', () => {
    const { rolls } = sample('rare', 300);
    for (const r of rolls) {
      if (r.kind === 'gold') {
        expect(r.currency.gold).toBeGreaterThanOrEqual(boxes.rare!.gold.min);
        expect(r.currency.gold).toBeLessThanOrEqual(boxes.rare!.gold.max);
      } else {
        // A piece's tier is its component count, and it's always a legal piece.
        expect(pieceComponentIds(r.item)).toHaveLength(r.tier);
        expect(describePiece(content, r.item)).toBeDefined();
      }
    }
  });

  it('get better from uncommon to rare to epic', () => {
    const u = sample('uncommon');
    const r = sample('rare');
    const e = sample('epic');
    expect(u.gold).toBeGreaterThan(r.gold);
    expect(r.gold).toBeGreaterThan(e.gold);
    expect(u.tier(3)).toBeLessThan(r.tier(3));
    expect(r.tier(3)).toBeLessThan(e.tier(3));
    expect(u.tier(2)).toBeLessThan(e.tier(2));
  }, SAMPLING);

  it('keep uncommon rewards small: mostly gold, rarely tier 3', () => {
    const u = sample('uncommon');
    expect(u.gold).toBeGreaterThan(0.5);
    expect(u.tier(3)).toBeLessThan(0.06);
  }, SAMPLING);

  it('weight the epic (level-up) box heavily toward good gear', () => {
    const e = sample('epic');
    expect(e.gold).toBeLessThan(0.2);
    expect(e.tier(2) + e.tier(3)).toBeGreaterThan(0.6);
  }, SAMPLING);

  it('are reproducible from a seed', () => {
    expect(openLootBox(content, 'epic', seedRng(42))).toEqual(openLootBox(content, 'epic', seedRng(42)));
  });
});

describe('random forged pieces', () => {
  it('are legal pieces of the size asked for', () => {
    for (let i = 0; i < 300; i++) {
      for (const size of [1, 2, 3]) {
        const id = randomForgedPiece(content, 'standard', size, seedRng(i * 31 + size));
        expect(pieceComponentIds(id)).toHaveLength(size);
        expect(describePiece(content, id), id).toBeDefined();
      }
    }
  });

  it('are built on a Skill when forged, so they always grant one', () => {
    for (let i = 0; i < 300; i++) {
      for (const size of [2, 3]) {
        const piece = describePiece(content, randomForgedPiece(content, 'standard', size, seedRng(i * 17 + size)))!;
        expect(piece.components[0]!.type).toBe('Skill');
        expect(piece.skills.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
