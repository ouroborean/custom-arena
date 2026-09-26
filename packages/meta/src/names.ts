// Generated character names: "<element epithet> <class title>" (GDD §7.2 nameGenerator).

import { pick, type RngState } from '@arena/engine';

const EPITHETS: Record<string, string[]> = {
  Fire: ['Ember', 'Cinder', 'Blaze', 'Ashen', 'Pyre'],
  Ice: ['Frost', 'Rime', 'Glacier', 'Winter', 'Hoarfrost'],
  Water: ['Tide', 'Brook', 'Current', 'Rain', 'Deep'],
  Lightning: ['Storm', 'Volt', 'Thunder', 'Arc', 'Static'],
  Wind: ['Gale', 'Zephyr', 'Squall', 'Drift', 'Tempest'],
  Earth: ['Stone', 'Root', 'Granite', 'Moss', 'Boulder'],
  Holy: ['Dawn', 'Radiant', 'Halo', 'Sanctified', 'Lumen'],
  Unholy: ['Grave', 'Blight', 'Hollow', 'Wretched', 'Dread'],
  Shadow: ['Dusk', 'Veil', 'Umbral', 'Night', 'Whisper'],
  Poison: ['Venom', 'Thorn', 'Viper', 'Mire', 'Nettle'],
};

const TITLES: Record<string, string[]> = {
  warrior: ['Warbringer', 'Blademaster', 'Vanguard'],
  knight: ['Knight', 'Sentinel', 'Champion'],
  druid: ['Druid', 'Wildshaper', 'Grovewarden'],
  ranger: ['Ranger', 'Pathfinder', 'Huntress'],
  monk: ['Monk', 'Ascetic', 'Fistmaster'],
  mage: ['Mage', 'Magus', 'Spellweaver'],
  rogue: ['Rogue', 'Cutthroat', 'Nightblade'],
  priest: ['Priest', 'Oracle', 'Cleric'],
  warlock: ['Warlock', 'Hexer', 'Occultist'],
  paladin: ['Paladin', 'Crusader', 'Templar'],
};

export function generateName(rng: RngState, classId: string, className: string, element: string): string {
  const epithet = pick(rng, EPITHETS[element] ?? ['Wandering']);
  const title = pick(rng, TITLES[classId] ?? [className]);
  return `${epithet} ${title}`;
}
