// Checks the art, audio and icon manifests (npm run assets:check): every key names a real
// class+element, minion, sound cue, archetype or status, every listed file exists, and how much is covered.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContentOrThrow } from '@arena/content';
import { CUES } from '../src/match/cues.js';
import { PORTRAIT_DIR, scanPortraits } from '../portraits.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const content = loadContentOrThrow();
const problems: string[] = [];

// Portraits come from character_images/ (portraits.ts), named '<element><class>prof.png'.
const scan = scanPortraits();
const portraits = scan.portraits;
for (const f of scan.unrecognized) problems.push(`character_images: "${f}" isn't named <element><class>prof.png`);
const elements = ['none', ...new Set(Object.values(content.skills).map((s) => s.element.toLowerCase()).filter((e) => e !== 'none'))];
const characterKeys = Object.keys(content.classes).flatMap((c) => elements.map((e) => `${c}.${e}`));
const minionKeys = Object.keys(content.minions).map((m) => `minion.${m}`);
for (const [key, files] of Object.entries(portraits)) {
  if (!characterKeys.includes(key) && !minionKeys.includes(key)) problems.push(`portraits: unknown key "${key}"`);
  for (const f of files) if (!existsSync(new URL(f, PORTRAIT_DIR))) problems.push(`portraits.${key}: missing file ${f}`);
}

const audio = (JSON.parse(readFileSync(join(root, 'audio', 'manifest.json'), 'utf8')) as { cues: Record<string, string> }).cues;
for (const [cue, file] of Object.entries(audio)) {
  if (!(CUES as readonly string[]).includes(cue)) problems.push(`audio: unknown cue "${cue}"`);
  if (!existsSync(join(root, 'audio', file))) problems.push(`audio.${cue}: missing file ${file}`);
}

const icons = JSON.parse(readFileSync(join(root, 'icons', 'manifest.json'), 'utf8')) as {
  skills: Record<string, string>;
  skillsById: Record<string, string>;
  statuses: Record<string, string>;
};
// Minion skills all share the Minion archetype, so they're iconed by skill id instead.
const archetypes = [...new Set(Object.values(content.skills).map((s) => s.archetype.toLowerCase()))].filter((a) => a !== 'minion');
const minionSkills = Object.values(content.skills).filter((s) => s.archetype === 'Minion').map((s) => s.id);
for (const [key, file] of Object.entries(icons.skills)) {
  if (!archetypes.includes(key)) problems.push(`icons.skills: unknown archetype "${key}"`);
  if (!existsSync(join(root, 'icons', file))) problems.push(`icons.skills.${key}: missing file ${file}`);
}
for (const [id, file] of Object.entries(icons.skillsById)) {
  if (!content.skills[id]) problems.push(`icons.skillsById: unknown skill "${id}"`);
  if (!existsSync(join(root, 'icons', file))) problems.push(`icons.skillsById.${id}: missing file ${file}`);
}
for (const [id, file] of Object.entries(icons.statuses)) {
  if (!content.statuses[id]) problems.push(`icons.statuses: unknown status "${id}"`);
  if (!existsSync(join(root, 'icons', file))) problems.push(`icons.statuses.${id}: missing file ${file}`);
}
// Item passives (eq_*) are left to the item's own art.
const iconStatuses = Object.keys(content.statuses).filter((id) => !id.startsWith('eq_'));

const withArt = (keys: string[]) => keys.filter((k) => portraits[k]?.length).length;
console.log(`Portraits: ${withArt(characterKeys)}/${characterKeys.length} class+element pairs, ${withArt(minionKeys)}/${minionKeys.length} minions have art (the rest use generated portraits).`);
console.log(`Sounds: ${Object.keys(audio).length}/${CUES.length} cues recorded (the rest are synthesized).`);
console.log(
  `Icons: ${archetypes.filter((a) => icons.skills[a]).length}/${archetypes.length} archetypes, ${minionSkills.filter((id) => icons.skillsById[id]).length}/${minionSkills.length} minion skills, ${iconStatuses.filter((id) => icons.statuses[id]).length}/${iconStatuses.length} statuses (the rest show letter codes).`,
);
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Manifests OK.');
