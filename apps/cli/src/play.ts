// Play a match in the terminal against a bot.
//
//   npm run play                      you are Player 1 vs the greedy bot, random teams
//   npm run play -- --seed 5 --bot random

import { createInterface } from 'node:readline/promises';
import {
  applyCommand,
  CommandError,
  createMatch,
  effectName,
  formatCost,
  formatEvent,
  legalQueueCommands,
  redactEvents,
  viewFor,
  type GameEvent,
  type GameState,
  type PlayerView,
  type QueueCommand,
} from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { greedyBot, randomBot, randomConfig } from '@arena/ai';
import { num, parseArgs } from './args.js';

const args = parseArgs(process.argv.slice(2));
const content = loadContentOrThrow();
const seed = num(args.seed, Math.floor(Math.random() * 1e6));
const bot = args.bot === 'random' ? randomBot(seed) : greedyBot(seed);
const ME = 0 as const;

const rl = createInterface({ input: process.stdin, terminal: false });
// Buffered line reader: unlike rl.question(), it never drops lines that arrive early (pasted/piped input).
const lines = rl[Symbol.asyncIterator]();
async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const next = await lines.next();
  if (next.done) {
    console.log('(input closed)');
    process.exit(0);
  }
  return next.value;
}
let { state, events } = createMatch(content, randomConfig(content, seed));

function printEvents(evts: readonly GameEvent[]): void {
  for (const e of redactEvents(evts, ME)) {
    if (e.t === 'energyGained' && e.player !== ME) continue;
    console.log(`  ${formatEvent(content, state.units, e)}`);
  }
}

function statusLine(view: PlayerView, unitId: string): string {
  const parts = view.effects
    .filter((e) => e.bearer === unitId)
    .map((e) => {
      const n = e.stacks > 1 ? `×${e.stacks}` : '';
      const v = e.value ? `(${e.value})` : '';
      const d = e.duration === null ? '' : `[${e.duration}]`;
      return `${effectName(content, e.defId)}${n}${v}${d}`;
    });
  return parts.length ? `  {${parts.join(', ')}}` : '';
}

function describe(cmd: QueueCommand, s: GameState): string {
  const u = s.units.find((x) => x.id === cmd.actor)!;
  const def = content.skills[u.skills[cmd.slot]!.defId]!;
  const t = cmd.targets[0] ? ` → ${s.units.find((x) => x.id === cmd.targets[0])!.name}` : '';
  return `${u.name}: ${def.name} [${formatCost(def.cost)}]${t}`;
}

function render(): QueueCommand[] {
  const view = viewFor(content, state, ME);
  const me = state.players[ME];
  console.log(`\n=== Turn ${state.turn} — your energy: S${me.energy.S} A${me.energy.A} I${me.energy.I} W${me.energy.W} ===`);
  for (const side of [ME, 1] as const) {
    console.log(side === ME ? 'Your team:' : 'Enemy team:');
    for (const u of view.units.filter((x) => x.owner === side)) {
      const hp = u.alive ? `${u.hp}/${u.maxHp}` : 'DEAD';
      console.log(`  ${u.name.padEnd(22)} ${hp.padStart(7)}${statusLine(view, u.id)}`);
      if (side === ME && u.alive) {
        const skills = u.skills.map((sl) => {
          const d = content.skills[sl.defId]!;
          return `${d.name}[${formatCost(d.cost)}]${sl.cooldown ? `(cd ${sl.cooldown})` : ''}`;
        });
        console.log(`      ${skills.join('  ')}`);
      }
    }
  }
  if (me.queue.length) {
    console.log('Queued:');
    me.queue.forEach((q, i) => console.log(`  u${i}: ${describe({ t: 'queue', actor: q.actor, slot: q.slot, targets: q.targets }, state)}`));
  }
  const options = legalQueueCommands(content, state, ME);
  console.log('Options:');
  options.forEach((o, i) => console.log(`  ${String(i).padStart(2)}. ${describe(o, state)}`));
  console.log('  e = end turn, u<N> = unqueue, d <id> = describe skill, q = surrender');
  return options;
}

async function humanTurn(): Promise<void> {
  for (;;) {
    const options = render();
    const input = (await ask('> ')).trim();
    try {
      if (input === 'e') {
        const r = applyCommand(content, state, ME, { t: 'endTurn' });
        state = r.state;
        printEvents(r.events);
        return;
      }
      if (input === 'q') {
        const r = applyCommand(content, state, ME, { t: 'surrender' });
        state = r.state;
        printEvents(r.events);
        return;
      }
      if (input.startsWith('u')) {
        state = applyCommand(content, state, ME, { t: 'unqueue', index: Number(input.slice(1)) }).state;
        continue;
      }
      if (input.startsWith('d ')) {
        const d = Object.values(content.skills).find((s) => s.name.toLowerCase() === input.slice(2).trim().toLowerCase());
        console.log(d ? `${d.name} [${formatCost(d.cost)}] cd ${d.cooldown}: ${d.description}` : 'No such skill');
        continue;
      }
      const pick = options[Number(input)];
      if (!pick || input === '') {
        console.log('?');
        continue;
      }
      state = applyCommand(content, state, ME, pick).state;
    } catch (e) {
      if (e instanceof CommandError) console.log(`Not allowed: ${e.message}`);
      else throw e;
    }
  }
}

console.log(`Custom Arena — seed ${seed}. You are Player 1 against the ${bot.name} bot.`);
printEvents(events);
while (state.phase !== 'finished') {
  if (state.activePlayer === ME) {
    await humanTurn();
  } else {
    for (const cmd of bot.planTurn(content, viewFor(content, state, 1))) {
      ({ state, events } = applyCommand(content, state, 1, cmd));
      printEvents(events);
      if (state.phase === 'finished') break;
    }
  }
}
const r = state.result!;
console.log(r.winner === null ? '\nDraw.' : r.winner === ME ? '\nYou win!' : '\nYou lose.');
rl.close();
