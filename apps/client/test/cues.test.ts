// Which sound each battle event makes.

import { describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { cueFor } from '../src/match/cues.js';
import { portraitKey, portraitUrl } from '../src/assets.js';

const content = loadContentOrThrow();
const damage = { t: 'damage', source: 'a', target: 'b', type: 'Normal', direct: true, hp: 50, base: 0, bonus: 0, armor: 0 } as const;

describe('sound cues', () => {
  it('scale hits and tell Shields apart', () => {
    expect(cueFor(content, { ...damage, amount: 15, absorbed: 0 }, 0)).toBe('hit');
    expect(cueFor(content, { ...damage, amount: 25, absorbed: 10 }, 0)).toBe('bigHit');
    expect(cueFor(content, { ...damage, amount: 0, absorbed: 15 }, 0)).toBe('shieldHit');
    expect(cueFor(content, { ...damage, amount: 0, absorbed: 0 }, 0)).toBeNull();
  });

  it('know Buffs, Debuffs and stuns, named or inline', () => {
    const applied = (defId: string) => ({ t: 'effectApplied', effect: 'e1', defId, bearer: 'b', source: 'a', stacks: 1, value: 0, duration: 2 }) as const;
    expect(cueFor(content, applied('might'), 0)).toBe('buff');
    expect(cueFor(content, applied('weakness'), 0)).toBe('debuff');
    expect(cueFor(content, applied('stun'), 0)).toBe('stun');
    expect(cueFor(content, applied('riposte:riposte'), 0)).toBe('buff'); // Riposte's inline effect
  });

  it('end the match from the viewer’s side', () => {
    const over = { t: 'gameOver', result: { winner: 1, reason: 'elimination' } } as const;
    expect(cueFor(content, over, 1)).toBe('victory');
    expect(cueFor(content, over, 0)).toBe('defeat');
  });
});

describe('portrait manifest', () => {
  it('keys characters by class and element, minions by id, and picks variants', () => {
    expect(portraitKey({ classId: 'warrior', element: 'Fire' })).toBe('warrior.fire');
    expect(portraitKey({ kind: 'minion', defId: 'wolf' })).toBe('minion.wolf');
    const m = { 'warrior.fire': ['a.webp', 'b.webp'] };
    expect(portraitUrl(m, 'warrior.fire', 'warrior.fire.02')).toBe('/assets/portraits/b.webp');
    expect(portraitUrl(m, 'warrior.fire', 'warrior.fire.07')).toBe('/assets/portraits/a.webp');
    expect(portraitUrl(m, 'mage.ice')).toBeNull();
  });
});
