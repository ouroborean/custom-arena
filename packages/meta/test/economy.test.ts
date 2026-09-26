import { describe, expect, it } from 'vitest';
import { seedRng } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { canAfford, craft, formatAmounts, matchReward, rollDrops, salvageValue, startingWallet, type MatchRewardInput } from '../src/index.js';

const content = loadContentOrThrow();
const win: MatchRewardInput = { kind: 'casual', outcome: 'win', endReason: 'elimination', turns: 20, dropsToday: 0 };

describe('economy', () => {
  it('new accounts start with the configured balances', () => {
    expect(startingWallet(content)).toEqual({ gold: 300 });
    expect(canAfford({ gold: 300 }, content.economy.roll.cost)).toBe(true);
    expect(canAfford({ gold: 99 }, content.economy.roll.cost)).toBe(false);
  });

  it('a casual win pays gold and one drop', () => {
    const r = matchReward(content, win, seedRng(1));
    expect(r.currency).toEqual({ gold: 40 });
    expect(r.items).toHaveLength(1);
    expect(content.items[r.items[0]!]).toBeDefined();
  });

  it('short matches, forfeited losses and private matches pay nothing', () => {
    expect(matchReward(content, { ...win, turns: 4 }, seedRng(1))).toEqual({ currency: {}, items: [] });
    expect(matchReward(content, { ...win, outcome: 'loss', endReason: 'surrender' }, seedRng(1))).toEqual({ currency: {}, items: [] });
    expect(matchReward(content, { ...win, kind: 'private' }, seedRng(1))).toEqual({ currency: {}, items: [] });
    expect(matchReward(content, { ...win, outcome: 'loss' }, seedRng(1))).toEqual({ currency: { gold: 15 }, items: [] });
  });

  it('the daily drop cap stops drops but not gold', () => {
    const r = matchReward(content, { ...win, dropsToday: content.economy.dailyDropCap }, seedRng(1));
    expect(r).toEqual({ currency: { gold: 40 }, items: [] });
  });

  it('drops follow the table: reproducible, never excluded types', () => {
    const a = rollDrops(content, 'standard', 200, seedRng(7));
    expect(rollDrops(content, 'standard', 200, seedRng(7))).toEqual(a);
    const types = new Set(a.map((id) => content.items[id]!.type));
    expect(types.has('I')).toBe(false); // Perfect Crystals are crafted, not dropped
    expect(types.has('K')).toBe(true);
  });

  it('three Shards of one element refine into its Perfect Crystal', () => {
    expect(craft(content, 'perfect_crystal', ['ice_shard', 'ice_shard', 'ice_shard'])).toEqual({
      ok: true,
      output: 'ice_crystal',
      cost: { gold: 50 },
    });
    const mixed = craft(content, 'perfect_crystal', ['ice_shard', 'fire_shard', 'ice_shard']);
    expect(mixed.ok).toBe(false);
    expect(craft(content, 'perfect_crystal', ['ice_shard', 'ice_shard']).ok).toBe(false);
    expect(craft(content, 'perfect_crystal', ['ice_shard', 'ice_shard', 'wind_katana']).ok).toBe(false);
  });

  it('salvage pays by type', () => {
    expect(salvageValue(content, 'wind_katana')).toEqual({ gold: 25 });
    expect(formatAmounts(content, { gold: 25 })).toBe('25 Gold');
  });
});
