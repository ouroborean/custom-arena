// Character portraits from character_images/: '<element><class>prof.png' maps to the manifest key
// '<class>.<element>', and anything else is reported rather than guessed.

import { describe, expect, it } from 'vitest';
import { PORTRAIT_CLASSES, PORTRAIT_ELEMENTS, portraitKeyOfFile } from '../portraits.js';

describe('portrait file names', () => {
  it('map <element><class>prof.png to the <class>.<element> key', () => {
    expect(portraitKeyOfFile('firewarriorprof.png')).toBe('warrior.fire');
    expect(portraitKeyOfFile('shadowpaladinprof.png')).toBe('paladin.shadow');
    expect(portraitKeyOfFile('unholyknightprof.png')).toBe('knight.unholy');
    expect(portraitKeyOfFile('holyknightprof.png')).toBe('knight.holy');
    expect(portraitKeyOfFile('lightningwarlockprof.webp')).toBe('warlock.lightning');
  });

  it('every element and class combination is recognized', () => {
    for (const el of PORTRAIT_ELEMENTS) for (const cls of PORTRAIT_CLASSES) expect(portraitKeyOfFile(`${el}${cls}prof.png`)).toBe(`${cls}.${el}`);
  });

  it('anything else is not guessed', () => {
    for (const f of ['FireWarriorprof.png', 'fire warriorprof.png', 'firewarrior.png', 'dragonwarriorprof.png', 'firepirateprof.png', 'firewarriorprof.gif']) {
      expect(portraitKeyOfFile(f), f).toBeNull();
    }
  });
});
