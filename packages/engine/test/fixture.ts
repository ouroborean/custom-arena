// A tiny hand-written content bundle for engine rule tests, so the engine can be tested without
// the real content package.

import {
  applyCommand,
  COLORS,
  createMatch,
  parseCost,
  type Command,
  type ContentBundle,
  type EffectDef,
  type GameEvent,
  type GameState,
  type Op,
  type PlayerId,
  type SkillDef,
  type SkillTag,
  type TargetKind,
} from '../src/index.js';

export function skill(
  id: string,
  target: TargetKind,
  ops: Op[],
  opts: { cost?: string; cd?: number; tags?: SkillTag[] } = {},
): SkillDef {
  const harmful = target === 'enemy' || target === 'allEnemies';
  const damaging = JSON.stringify(ops).includes('"op":"damage"');
  return {
    id,
    archetype: id,
    element: 'None',
    name: id,
    description: id,
    cost: parseCost(opts.cost ?? ''),
    cooldown: opts.cd ?? 0,
    tags: opts.tags ?? [harmful ? 'Harmful' : 'Helpful', damaging ? 'NonStrategic' : 'Strategic'],
    target,
    ops,
  };
}

const statuses: Record<string, EffectDef> = {
  might: { id: 'might', name: 'Might', kind: 'Buff', modifiers: [{ mod: 'damageDealt', amount: 5, perStack: true, when: { direct: true } }] },
  armor: {
    id: 'armor',
    name: 'Armor',
    kind: 'Buff',
    modifiers: [{ mod: 'damageTaken', amount: -5, perStack: true, armor: true, when: { types: ['Normal'] } }],
  },
  shield: { id: 'shield', name: 'Shield', kind: 'Buff', shield: true },
  shattered: { id: 'shattered', name: 'Shattered', kind: 'Debuff', modifiers: [{ mod: 'noArmorOrShield' }] },
  stun: { id: 'stun', name: 'Stunned', kind: 'Debuff', modifiers: [{ mod: 'cannotUseSkills' }] },
  invulnerable: {
    id: 'invulnerable',
    name: 'Invulnerable',
    kind: 'Buff',
    modifiers: [{ mod: 'untargetable', by: 'enemies', bypassable: true }, { mod: 'blockIndirectDamage' }],
  },
  confusion: { id: 'confusion', name: 'Confusion', kind: 'Debuff', modifiers: [{ mod: 'costGeneric', amount: 1, perStack: true }] },
};

export function bundle(skills: SkillDef[], extra: Partial<ContentBundle> = {}): ContentBundle {
  return {
    version: 'test',
    skills: Object.fromEntries(skills.map((s) => [s.id, s])),
    statuses: { ...statuses, ...extra.statuses },
    minions: extra.minions ?? {},
    classes: {},
    macros: extra.macros ?? {},
    items: extra.items ?? {},
    conditions: extra.conditions ?? {},
    economy: { currencies: {}, roll: { cost: {} }, rewards: {}, dailyDropCap: 0, dropTables: {}, recipes: {}, salvage: {} },
    encounters: {},
    chapters: {},
    achievements: {},
    fusions: {},
    glossary: {},
    tutorial: {},
  };
}

export class Match {
  state: GameState;
  events: GameEvent[] = [];
  constructor(
    public c: ContentBundle,
    teams: [string[][], string[][]],
    seed = 7,
  ) {
    const mk = (side: string[][], p: number) => side.map((skills, i) => ({ name: `${p}-${i}`, skills }));
    const r = createMatch(c, { seed, teams: [mk(teams[0], 0), mk(teams[1], 1)] });
    this.state = r.state;
    this.events.push(...r.events);
    this.fill();
  }
  fill(): void {
    if (this.state.phase === 'finished') return;
    const p = this.state.players[this.state.activePlayer];
    for (const c of COLORS) p.energy[c] = Math.max(p.energy[c], 10);
  }
  cmd(player: PlayerId, c: Command): this {
    const r = applyCommand(this.c, this.state, player, c);
    this.state = r.state;
    this.events.push(...r.events);
    return this;
  }
  use(actor: string, slot: number, target?: string): this {
    const owner = this.state.units.find((u) => u.id === actor)!.owner;
    return this.cmd(owner, { t: 'queue', actor, slot, targets: target ? [target] : [] });
  }
  end(): this {
    this.cmd(this.state.activePlayer, { t: 'endTurn' });
    this.fill();
    return this;
  }
  hp(id: string): number {
    return this.state.units.find((u) => u.id === id)!.hp;
  }
  give(id: string, status: string, stacks = 1, value = 0): this {
    const u = this.state.units.find((x) => x.id === id)!;
    this.state.effects.push({
      id: `t${this.state.effects.length}`,
      defId: status,
      source: id,
      sourceOwner: u.owner,
      bearer: id,
      stacks,
      value,
      duration: null,
      targets: [],
      revealed: false,
      data: {},
      seq: 0,
    });
    return this;
  }
}
