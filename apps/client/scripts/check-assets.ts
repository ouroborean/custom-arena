// Checks the art and audio manifests (npm run assets:check): every key names a real class+element,
// minion or sound cue, every listed file exists, and how much of the roster has portrait art.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContentOrThrow } from '@arena/content';
import { CUES } from '../src/match/cues.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const content = loadContentOrThrow();
const problems: string[] = [];

const portraits = (JSON.parse(readFileSync(join(root, 'portraits', 'manifest.json'), 'utf8')) as { portraits: Record<string, string[]> }).portraits;
const elements = ['none', ...new Set(Object.values(content.skills).map((s) => s.element.toLowerCase()).filter((e) => e !== 'none'))];
const characterKeys = Object.keys(content.classes).flatMap((c) => elements.map((e) => `${c}.${e}`));
const minionKeys = Object.keys(content.minions).map((m) => `minion.${m}`);
for (const [key, files] of Object.entries(portraits)) {
  if (!characterKeys.includes(key) && !minionKeys.includes(key)) problems.push(`portraits: unknown key "${key}"`);
  for (const f of files) if (!existsSync(join(root, 'portraits', f))) problems.push(`portraits.${key}: missing file ${f}`);
}

const audio = (JSON.parse(readFileSync(join(root, 'audio', 'manifest.json'), 'utf8')) as { cues: Record<string, string> }).cues;
for (const [cue, file] of Object.entries(audio)) {
  if (!(CUES as readonly string[]).includes(cue)) problems.push(`audio: unknown cue "${cue}"`);
  if (!existsSync(join(root, 'audio', file))) problems.push(`audio.${cue}: missing file ${file}`);
}

const withArt = (keys: string[]) => keys.filter((k) => portraits[k]?.length).length;
console.log(`Portraits: ${withArt(characterKeys)}/${characterKeys.length} class+element pairs, ${withArt(minionKeys)}/${minionKeys.length} minions have art (the rest use generated portraits).`);
console.log(`Sounds: ${Object.keys(audio).length}/${CUES.length} cues recorded (the rest are synthesized).`);
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Manifests OK.');
