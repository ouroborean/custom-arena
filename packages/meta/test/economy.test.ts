import { describe, expect, it } from 'vitest';
import { seedRng } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { canAfford, forge, formatAmounts, matchReward, rollDrops, salvageValue, splitPiece, startingWallet, type MatchRewardInput } from '../src/index.js';

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

  it('drops are single components, by the table: reproducible, of every type it weights', () => {
    const a = rollDrops(content, 'standard', 200, seedRng(7));
    expect(rollDrops(content, 'standard', 200, seedRng(7))).toEqual(a);
    expect(a.every((id) => !id.includes('+') && content.items[id])).toBe(true); // forged pieces are made, not dropped
    expect(new Set(a.map((id) => content.items[id]!.type))).toEqual(new Set(['Skill', 'Shard', 'Sigil']));
  });

  it('forging costs more for a three-component piece; the base keeps its place at the front', () => {
    expect(forge(content, 'shortbow', 'chalice')).toEqual({ ok: true, piece: 'shortbow+chalice', cost: { gold: 50 } });
    expect(forge(content, 'shortbow+chalice', 'spear')).toEqual({ ok: true, piece: 'shortbow+chalice+spear', cost: { gold: 100 } });
    expect(forge(content, 'spear', 'shortbow+chalice')).toMatchObject({ ok: true, piece: 'spear+shortbow+chalice' });
  });

  it('forging refuses a fourth component, a second Sigil and a skill twice', () => {
    expect(forge(content, 'shortbow+chalice', 'spear+ice_shard')).toMatchObject({ ok: false });
    expect(forge(content, 'sigil_momentum', 'sigil_eruptions')).toMatchObject({ ok: false });
    expect(forge(content, 'shortbow', 'shortbow')).toMatchObject({ ok: false });
    expect(forge(content, 'fire_shard', 'fire_shard')).toMatchObject({ ok: true }); // elements can repeat
  });

  it('splitting a forged piece gives back its components, for a fee; a single component cannot split', () => {
    expect(splitPiece(content, 'longsword+wind_shard+sigil_momentum')).toEqual({
      ok: true,
      components: ['longsword', 'wind_shard', 'sigil_momentum'],
      cost: { gold: 25 },
    });
    expect(splitPiece(content, 'longsword').ok).toBe(false);
  });

  it('salvage pays for each component by its type', () => {
    expect(salvageValue(content, 'longsword')).toEqual({ gold: 10 });
    expect(salvageValue(content, 'longsword+wind_shard+sigil_momentum')).toEqual({ gold: 45 });
    expect(formatAmounts(content, { gold: 25 })).toBe('25 Gold');
  });
});
