// Forged equipment, from docs/forging-names.md and docs/equipment.md §6: what a piece may hold and
// what it's called.

import { describe, expect, it } from 'vitest';
import { describePiece, pieceProblems } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';

const content = loadContentOrThrow();
const name = (id: string) => describePiece(content, id)?.name;

describe('what a piece can hold', () => {
  it('one to three components, at most one Sigil, no skill twice; elements may repeat', () => {
    expect(pieceProblems(content, ['longsword'])).toEqual([]);
    expect(pieceProblems(content, ['longsword', 'wind_shard', 'sigil_momentum'])).toEqual([]);
    expect(pieceProblems(content, ['fire_shard', 'fire_shard', 'fire_shard'])).toEqual([]);
    expect(pieceProblems(content, [])).not.toEqual([]);
    expect(pieceProblems(content, ['longsword', 'spear', 'shortbow', 'chalice'])).not.toEqual([]);
    expect(pieceProblems(content, ['sigil_momentum', 'sigil_eruptions'])).not.toEqual([]);
    expect(pieceProblems(content, ['longsword', 'longsword'])).not.toEqual([]);
    expect(pieceProblems(content, ['longsword', 'nothing'])).not.toEqual([]);
  });

  it('a piece grants every component: skills in forge order, infusions, and the Sigil passive', () => {
    const p = describePiece(content, 'longsword+wind_shard+sigil_momentum')!;
    expect(p.skills).toEqual(['strike']);
    expect(p.infusions).toEqual([{ element: 'Wind' }]);
    expect(p.passiveEffect).toBe('eq_wind_katana');
  });
});

describe('names', () => {
  it('a single component is named as itself', () => {
    expect(name('greathammer')).toBe('Greathammer');
    expect(name('fire_shard')).toBe('Fire Shard');
    expect(name('sigil_momentum')).toBe('Sigil of Momentum');
  });

  it('two skills take the pair name, whichever was forged first', () => {
    expect(name('shortbow+chalice')).toBe('Saint Bow');
    expect(name('chalice+shortbow')).toBe('Saint Bow');
    expect(name('longsword+shield')).toBe('Sword & Shield');
  });

  it("a third skill adds its prefix to the first two's pair, so forge order shows", () => {
    expect(name('shortbow+chalice+spear')).toBe('Reckless Saint Bow'); // Charge added to a Saint Bow
    expect(name('spear+chalice+shortbow')).toBe("Hawkeye's Battle Censer"); // Shot added to a Battle Censer
  });

  it('elements on a skill piece add one infusion prefix: the element, or the fusion of two', () => {
    expect(name('warhelm+fire_shard')).toBe('Fire-Infused Warhelm');
    expect(name('warhelm+fire_shard+earth_shard')).toBe('Sun-Infused Warhelm');
    expect(name('warhelm+earth_shard+fire_shard')).toBe('Sun-Infused Warhelm');
    expect(name('shortbow+chalice+ice_shard')).toBe('Ice-Infused Saint Bow');
  });

  it('two shards are their fusion\'s Crystal; Ice + Ice is the Pure Crystal', () => {
    expect(name('fire_shard+fire_shard')).toBe('Dragon Crystal');
    expect(name('fire_shard+earth_shard')).toBe('Sun Crystal');
    expect(name('ice_shard+ice_shard')).toBe('Pure Crystal');
  });

  it('three shards are a Geode, named the same in any order', () => {
    expect(name('fire_shard+fire_shard+fire_shard')).toBe('Geode of the True Dragon');
    expect(name('fire_shard+fire_shard+ice_shard')).toBe('Geode of the Frost Drake');
    expect(name('ice_shard+fire_shard+fire_shard')).toBe('Geode of the Frost Drake');
  });

  it('a Sigil ends the name with its suffix; alone it is a Sigil', () => {
    expect(name('warhelm+sigil_defiance')).toBe('Warhelm of Defiance');
    expect(name('warhelm+earth_shard+sigil_defiance')).toBe('Earth-Infused Warhelm of Defiance');
    expect(name('fire_shard+sigil_inferno')).toBe('Fire Shard of the Inferno');
    expect(name('fire_shard+fire_shard+sigil_inferno')).toBe('Dragon Crystal of the Inferno');
    expect(name('shortbow+chalice+sigil_inevitability')).toBe('Saint Bow of Inevitability');
  });

  it('every pair of skills and every set of three shards has a name of its own', () => {
    const skills = Object.values(content.items).filter((i) => i.type === 'Skill');
    const shards = Object.values(content.items).filter((i) => i.type === 'Shard');
    const pairs = skills.flatMap((a, i) => skills.slice(i + 1).map((b) => name(`${a.id}+${b.id}`)));
    expect(pairs).toHaveLength(435);
    expect(new Set(pairs).size).toBe(435);
    const geodes = shards.flatMap((a, i) => shards.slice(i).flatMap((b, j) => shards.slice(i + j).map((c) => name(`${a.id}+${b.id}+${c.id}`))));
    expect(geodes).toHaveLength(220);
    expect(new Set(geodes).size).toBe(220);
    expect([...pairs, ...geodes].every((n) => n && !/undefined|Shard,/.test(n))).toBe(true);
  });
});
