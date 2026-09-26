// Scripted encounter AI (GDD §11.9 "Scripted"): authored rules queue specific skills when their
// conditions hold; the encounter's difficulty tier plans everything else. Rules read only the view.

import {
  applyCommand,
  legalQueueCommands,
  seedRng,
  type Command,
  type ContentBundle,
  type EncounterDef,
  type GameState,
  type PlayerId,
  type PlayerView,
  type QueueCommand,
  type ScriptRule,
  type Unit,
} from '@arena/engine';
import type { Bot } from './bots.js';
import { botFor, continuePlan, determinize, type Difficulty } from './search.js';

function ruleApplies(rule: ScriptRule, view: PlayerView, ownTurn: number): boolean {
  const w = rule.when;
  if (!w) return true;
  if (w.turn !== undefined && ownTurn !== w.turn) return false;
  if (w.every !== undefined && ownTurn % w.every !== 0) return false;
  if (w.from !== undefined && ownTurn < w.from) return false;
  if (w.hpAtMost) {
    const u = view.units.find((x) => x.id === `p${view.viewer}c${w.hpAtMost!.unit}`);
    if (!u?.alive || u.hp > w.hpAtMost.value) return false;
  }
  return true;
}

/** The option a rule asks for, if it's legal right now. */
function ruleCommand(content: ContentBundle, s: GameState, me: PlayerId, rule: ScriptRule): QueueCommand | null {
  const actor = s.units.find((u) => u.id === `p${me}c${rule.unit}`);
  if (!actor?.alive) return null;
  const slot = actor.skills.findIndex((sk) => sk.defId === rule.skill || sk.defId.startsWith(`${rule.skill}.`));
  if (slot < 0) return null;
  const options = legalQueueCommands(content, s, me).filter((o) => o.actor === actor.id && o.slot === slot);
  if (options.length <= 1) return options[0] ?? null;
  const unitOf = (o: QueueCommand) => s.units.find((u) => u.id === o.targets[0]);
  const by = (pick: (u: Unit) => boolean, order: (a: Unit, b: Unit) => number) =>
    options
      .filter((o) => {
        const u = unitOf(o);
        return !!u && pick(u);
      })
      .sort((a, b) => order(unitOf(a)!, unitOf(b)!))[0] ?? null;
  const t = rule.target ?? 'lowestHp';
  if (t === 'self') return options.find((o) => o.targets[0] === actor.id) ?? null;
  if (t === 'weakestAlly') return by((u) => u.owner === me, (a, b) => a.hp - b.hp);
  if (typeof t === 'number') return options.find((o) => o.targets[0] === `p${me === 0 ? 1 : 0}c${t}`) ?? null;
  const enemy = (u: Unit) => u.owner !== me;
  return t === 'highestHp' ? by(enemy, (a, b) => b.hp - a.hp) : by(enemy, (a, b) => a.hp - b.hp);
}

/**
 * A bot that follows script rules first (in order; each at most one queued skill), then lets the
 * `tier` plan the rest of the turn. With no rule firing, it's exactly the tier's bot.
 */
export function scriptedBot(rules: readonly ScriptRule[], tier: Difficulty, seed: number): Bot {
  const fallback = botFor(tier, seed);
  const rng = seedRng(seed ^ 0x51ed);
  return {
    name: `scripted-${tier}`,
    planTurn(content, view) {
      const me = view.viewer;
      const ownTurn = view.players[me].turnsTaken + 1;
      const firing = rules.filter((r) => ruleApplies(r, view, ownTurn));
      if (firing.length === 0) return fallback.planTurn(content, view);
      let s = determinize(view, rng);
      const out: Command[] = [];
      for (const rule of firing) {
        const cmd = ruleCommand(content, s, me, rule);
        if (!cmd) continue;
        s = applyCommand(content, s, me, cmd).state;
        out.push(cmd);
      }
      out.push(...continuePlan(content, s, me, tier, rng));
      out.push({ t: 'endTurn' });
      return out;
    },
  };
}

/** The bot an encounter's enemy uses. */
export function encounterBot(enc: EncounterDef, seed: number): Bot {
  return enc.ai.script?.length ? scriptedBot(enc.ai.script, enc.ai.tier, seed) : botFor(enc.ai.tier, seed);
}
