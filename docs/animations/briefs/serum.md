# Serum — animation brief

Group id: `serum`. Element(s): Water + Poison. Concept file: `docs/animations/concepts/serum.yaml`.
Skill source: `packages/content/data/fusions/serum/skills.serum.yaml`; minions: `packages/content/data/fusions/serum/minions.serum.yaml`; statuses: `packages/content/data/fusions/serum/statuses.serum.yaml`; macros: `packages/content/data/fusions/serum/macros.serum.yaml`.

## Skills (33)

### `strike.serum` — Hypodermic Strike
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, +5 per Dose they have. Then they gain 2 Dose.
- applies: dose · ops: damage, apply

### `smash.serum` — Liquid Courage
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- The user gains 1 Dose, then deals 20 damage to target enemy and 10 to their allies, 5 more to each per Dose the user has.
- applies: dose · ops: apply, damage

### `charge.serum` — Fermenting Jab
- Charge · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who gains 1 Dose. Through the user's next turn, Dose on enemies doesn't heal them; each time it would, it grows by 1 stack instead.
- applies: dose · inline statuses: fermenting · ops: damage, apply
  - inline `fermenting` (Debuff): The bearer's Dose grows by 1 stack instead of healing them.

### `riposte.serum` — Reactive Serum
- Riposte · cost I · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user; its user gains 3 Dose. Invisible.
- applies: dose · inline statuses: reactive_serum · ops: apply
  - inline `reactive_serum` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; their users gain 3 Dose.

### `rage.serum` — Stimulant Binge
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune and 1 Might at the start of each of their turns (max 3). If they deal no direct damage on a turn, it ends and they take 20 Affliction damage.
- applies: might · inline statuses: stimulant_binge · ops: setCounter, apply, if, setFlag, removeSelf, damage
  - inline `stimulant_binge` (Buff; triggers: turnStart, dealtDamage, turnEnd): Immune, and 1 Might each turn (max 3); a turn without a damaging skill ends it and deals the bearer 20 Affliction damage.

### `shot.serum` — Purging Dart
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, +10 for each Debuff on the user. Those Debuffs end.
- ops: damage, removeKind

### `snipe.serum` — Tracer Dye
- Snipe · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user deals 25 damage to target enemy on the following turn, plus as much as that enemy was healed in the meantime. The target of this skill is invisible. Channeled.
- inline statuses: tracer_dye_trace, tracer_dye · ops: setCounter, apply, forEach, damage
  - inline `tracer_dye_trace` (Neutral, hidden; triggers: healed): Healing the bearer receives is added to the damage of the applier's Tracer Dye.
  - inline `tracer_dye` (Neutral): Strikes its target at the end of the following turn for 25, plus the healing they received meanwhile.

### `trap.serum` — Tainted Supply
- Trap · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, each time target enemy is healed, they gain 1 Dose. Invisible.
- applies: dose · inline statuses: tainted_supply · ops: apply
  - inline `tainted_supply` (Debuff, hidden; triggers: healed): Each time the bearer is healed, they gain 1 Dose.

### `maneuver.serum` — Stimulant
- Maneuver · cost I · cooldown 2 · target **self** · tags Helpful, Strategic, Unstunnable
- The user becomes Invulnerable for 1 turn. Their Dose moves to a random enemy; if they had none, they gain 2. Unstunnable.
- applies: invulnerable, dose · ops: apply, if, moveEffects

### `companion.serum` — Giant Leech
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Giant Leech (25 HP) permanently. Latch (r): 5 Piercing damage and 1 Dose. Bloodletting (rr): target ally loses 2 Dose and heals 10.
- summons: giant_leech · ops: summon

### `bolt.serum` — Pressurized Dose
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 2 Dose. While they have Dose, they count as Prey.
- applies: dose · inline statuses: pressurized · ops: damage, apply
  - inline `pressurized` (Debuff): While the bearer has Dose, they count as Prey.

### `blast.serum` — Acid Rain
- Blast · cost Wr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, and each gains 1 Dose. Then all Dose on the enemy team moves onto one random enemy who has it.
- applies: dose · ops: damage, apply, forEach, moveEffects

### `consume.serum` — Extraction
- Consume · cost r · cooldown 2 · target **any** · tags Radiant, Strategic
- Removes all Dose from target unit: an enemy takes 10 Affliction damage per stack; an ally heals 10 per stack. Either way, it counts at least 2 stacks.
- ops: set, removeEffect, if, damage, heal

### `summon.serum` — Spriggan Nurse
- Summon · cost I · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons a Spriggan Nurse (15 HP) for 3 turns. Titrate (W): target ally gains 1 Dose; if they have 3, a random enemy gains 2 instead.
- summons: spriggan_nurse · ops: summon

### `channel.serum` — Drip
- Channel · cost rr · cooldown 3 · target **enemy** · tags Harmful, Strategic, Channeled
- For up to 4 turns, at the end of each of the user's turns, target enemy gains 1 Dose and takes 5 Affliction damage per Dose they have. It ends when they Overdose. Channeled.
- applies: dose · inline statuses: drip · ops: apply, forEach, if, damage, removeSelf
  - inline `drip` (Neutral; triggers: turnEnd, signal): Each turn, the target gains 1 Dose and takes 5 Affliction per Dose; ends when they Overdose.

### `stab.serum` — Microdose
- Stab · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy now and at the start of each of their next 3 turns. Each hit is 15 instead while they're at or below 60 HP.
- inline statuses: microdose · ops: damage, apply
  - inline `microdose` (Debuff; triggers: turnStart): At the start of each of the bearer's turns, 5 damage (15 at or below 60 HP).

### `ravage.serum` — Toxic Injection
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. For 2 turns, their Toxin also ticks at the start of each of their turns.
- inline statuses: toxic_injection · ops: damage, apply
  - inline `toxic_injection` (Debuff; triggers: turnStart): The bearer's Toxin also ticks at the start of their turns.

### `mislead.serum` — Placebo
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Helpful skill, it's countered, and each of its targets gains 2 Dose. Invisible.
- applies: dose · inline statuses: placebo · ops: apply
  - inline `placebo` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Helpful skill is countered, and its targets gain 2 Dose.

### `stun.serum` — Sedative
- Stun · cost I · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Stuns them for 1 turn, +1 turn per 2 Dose they have (max 3 turns).
- applies: stun · ops: damage, apply

### `dance.serum` — Rebalance
- Dance · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- All Toxin on allies turns into Renew, and all Renew on enemies turns into Toxin.
- applies: renew, toxin · ops: forEach, set, removeEffect, apply

### `heal.serum` — Relief Valve
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15 and gains 2 Dose. For 2 turns, if they Overdose, the damage hits a random enemy instead of them.
- applies: dose · inline statuses: relief_valve · ops: apply, if, set, removeEffect, damage, signal, heal
  - inline `relief_valve` (Buff; triggers: effectGained): If the bearer Overdoses, they still lose all Dose, but a random enemy takes the damage.

### `bless.serum` — Mithridate
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 1 turn, each Debuff target ally would gain turns into 1 Dose instead.
- applies: dose · inline statuses: mithridate · ops: apply, eventEffect
  - inline `mithridate` (Buff; triggers: effectGained): Each Debuff the bearer would gain becomes 1 Dose instead.

### `curse.serum` — Side Effects
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 2 Dose. For 2 turns, each skill they use gives them 1 more.
- applies: dose · inline statuses: side_effects · ops: apply
  - inline `side_effects` (Debuff; triggers: skillUsed): Each skill the bearer uses gives them 1 Dose.

### `smite.serum` — Mercy Dose
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Sanctified for 1 turn. For 1 turn, an ally who damages them executes them if it leaves them below 15 HP.
- applies: sanctify · inline statuses: mercy_dose · ops: damage, apply, if, kill
  - inline `mercy_dose` (Debuff; triggers: damaged): An ally of the applier who leaves the bearer below 15 HP executes them.

### `prayer.serum` — Tonic Round
- Prayer · cost Ir · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 10 per Dose they have (at least 10) and lose 1 Dose. All enemies gain 1 Dose.
- applies: dose · ops: forEach, heal, removeStacks, apply

### `cleave.serum` — Lashing Spray
- Cleave · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 1 Dose. For 2 turns, the first 2 times they're healed, each of their allies takes 10 damage.
- applies: dose · inline statuses: lashing_spray · ops: damage, apply, if, removeSelf, setFlag
  - inline `lashing_spray` (Debuff; triggers: healed): The first 2 times the bearer is healed, each of their allies takes 10 damage.

### `shout.serum` — Bad Batch
- Shout · cost r · cooldown 1 · target **allEnemies** · tags Harmful, Strategic
- Every unit that has Dose gains 1 more, allies included. If no enemy has Dose, every enemy gains 1 instead.
- applies: dose · ops: if, apply

### `withstand.serum` — Clotting Agent
- Withstand · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 2 Dose. For 1 turn, each time they take direct damage, their Dose acts at once: they heal 5 per stack.
- applies: dose · inline statuses: clotting_agent · ops: apply, heal
  - inline `clotting_agent` (Buff; triggers: damaged): Each direct hit on the bearer makes their Dose heal them at once, 5 per stack.

### `taunt.serum` — Bitter Tonic
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- The user gains 2 Dose and Taunts target enemy for 2 turns. Each time that enemy hits the user meanwhile, 1 of the user's Dose moves onto them.
- applies: dose, taunt · inline statuses: bitter_tonic · ops: apply, if, removeStacks
  - inline `bitter_tonic` (Buff; triggers: damaged): Each time the enemy the bearer Taunted hits them, 1 of their Dose moves onto that enemy.

### `titan.serum` — Mutagen
- Titan · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 3 Dose and can't Overdose for 3 turns; meanwhile, 2 Might and 2 Armor. When it ends, they Overdose if they have 4 or more.
- applies: dose, might, armor · inline statuses: mutagen · macros: overdose · ops: apply, if, forEach, macro
  - inline `mutagen` (Buff): Can't Overdose; at 4 or more Dose when this ends, they Overdose.

### `giant_leech_latch` — Latch (minion skill of `giant_leech`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, who gains 1 Dose.
- applies: dose · ops: damage, apply

### `giant_leech_bloodletting` — Bloodletting (minion skill of `giant_leech`)
- Minion · cost rr · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally loses 2 Dose and heals 10.
- ops: removeStacks, heal

### `spriggan_nurse_titrate` — Titrate (minion skill of `spriggan_nurse`)
- Minion · cost W · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Dose; if they have 3, a random enemy gains 2 instead.
- applies: dose · ops: if, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `giant_leech` — Giant Leech, 25 HP; skills: giant_leech_latch, giant_leech_bloodletting
- `spriggan_nurse` — Spriggan Nurse, 15 HP; skills: spriggan_nurse_titrate

## Named statuses defined here (1) — this group owns their default animations

- `dose` — Dose (Buff; triggers: turnEnd, effectGained): At the end of its applier's turn, the bearer heals 5 per stack. At 4 Dose, they Overdose: 10 Affliction damage per stack, and all Dose is lost. _Applied by skills in: serum._

## Macros defined here (1) — this group owns their default animations

- `overdose`: ops set, removeEffect, damage, signal. _Used by: serum._
