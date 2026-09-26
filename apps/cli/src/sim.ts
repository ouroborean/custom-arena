// Headless bot-vs-bot simulator.
//
//   npm run sim                          one match, full battle log
//   npm run sim -- --seed 7 --save       ...and write replays/match-7.json
//   npm run sim -- --games 2000          aggregate results + per-skill win rates
//   npm run sim -- --bots greedy,random  choose bots (greedy | random)
//   npm run sim -- --replay replays/match-7.json   re-run a saved match and verify it

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { formatEvent, replay, stateFingerprint, type MatchRecord } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { greedyBot, playMatch, randomBot, randomConfig, type Bot } from '@arena/ai';
import { num, parseArgs } from './args.js';

const args = parseArgs(process.argv.slice(2));
const content = loadContentOrThrow();

function makeBot(kind: string, seed: number): Bot {
  if (kind === 'greedy') return greedyBot(seed);
  if (kind === 'random') return randomBot(seed);
  throw new Error(`Unknown bot "${kind}" (use greedy or random)`);
}

if (typeof args.replay === 'string') {
  const record = JSON.parse(readFileSync(args.replay, 'utf8')) as MatchRecord;
  const { state, events } = replay(content, record);
  for (const e of events) console.log(formatEvent(content, state.units, e));
  process.exit(0);
}

const [k0, k1] = (typeof args.bots === 'string' ? args.bots : 'greedy,greedy').split(',');
const seed = num(args.seed, 1);
const games = num(args.games, 1);

if (games === 1) {
  const config = randomConfig(content, seed);
  const played = playMatch(content, config, [makeBot(k0 ?? 'greedy', seed), makeBot(k1 ?? k0 ?? 'greedy', seed + 1)]);
  for (const [p, team] of config.teams.entries()) {
    console.log(`Player ${p + 1}:`);
    for (const c of team) console.log(`  ${c.name.padEnd(20)} ${c.skills.map((s) => content.skills[s]!.name).join(', ')}`);
  }
  console.log('');
  for (const e of played.events) {
    if (e.t === 'energyGained' && !args.verbose) continue;
    console.log(formatEvent(content, played.state.units, e));
  }
  const again = replay(content, played.record);
  const ok = stateFingerprint(again.state) === stateFingerprint(played.state);
  console.log(`\nreplay check: ${ok ? 'identical' : 'MISMATCH'} (${played.record.commands.length} commands)`);
  if (args.save) {
    mkdirSync('replays', { recursive: true });
    const file = `replays/match-${seed}.json`;
    writeFileSync(file, JSON.stringify(played.record, null, 2));
    console.log(`saved ${file}`);
  }
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------- aggregate mode

const wins = { p1: 0, p2: 0, draw: 0 };
let turns = 0;
const skillStats = new Map<string, { games: number; wins: number }>();
const elementStats = new Map<string, { chars: number; wins: number }>();
const started = performance.now();
for (let i = 0; i < games; i++) {
  const s = seed + i;
  const config = randomConfig(content, s);
  const { state } = playMatch(content, config, [makeBot(k0 ?? 'greedy', s), makeBot(k1 ?? k0 ?? 'greedy', s + 1)]);
  const w = state.result!.winner;
  if (w === null) wins.draw++;
  else if (w === 0) wins.p1++;
  else wins.p2++;
  turns += state.turn;
  config.teams.forEach((team, p) => {
    for (const c of team) {
      const el = c.element ?? 'None';
      const st = elementStats.get(el) ?? { chars: 0, wins: 0 };
      st.chars++;
      if (w === p) st.wins++;
      elementStats.set(el, st);
    }
    for (const id of new Set(team.flatMap((c) => c.skills))) {
      const st = skillStats.get(id) ?? { games: 0, wins: 0 };
      st.games++;
      if (w === p) st.wins++;
      skillStats.set(id, st);
    }
  });
}
const ms = performance.now() - started;
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
console.log(`${games} matches (${k0} vs ${k1 ?? k0}) in ${(ms / 1000).toFixed(1)}s — ${(ms / games).toFixed(1)} ms/match`);
console.log(`P1 ${pct(wins.p1)}  P2 ${pct(wins.p2)}  draw ${pct(wins.draw)}  avg turns ${(turns / games).toFixed(1)}`);
console.log('\nWin rate by character element (per character fielded):');
for (const [el, st] of [...elementStats.entries()].sort()) {
  console.log(`  ${el.padEnd(10)} ${((100 * st.wins) / st.chars).toFixed(1).padStart(5)}%  (n=${st.chars})`);
}
console.log('\nSkill win rate (team had the skill):');
const rows = [...skillStats.entries()].map(([id, st]) => ({ id, rate: st.wins / st.games, n: st.games }));
rows.sort((a, b) => b.rate - a.rate);
for (const r of rows) {
  const flag = r.rate > 0.55 ? '  ▲' : r.rate < 0.45 ? '  ▼' : '';
  console.log(`  ${content.skills[r.id]!.name.padEnd(12)} ${(100 * r.rate).toFixed(1).padStart(5)}%  (n=${r.n})${flag}`);
}
