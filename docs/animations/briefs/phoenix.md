# Phoenix — animation brief

Group id: `phoenix`. Element(s): Fire + Holy. Concept file: `docs/animations/concepts/phoenix.yaml`.
Skill source: `packages/content/data/fusions/phoenix/skills.phoenix.yaml`; minions: `packages/content/data/fusions/phoenix/minions.phoenix.yaml`; statuses: `packages/content/data/fusions/phoenix/statuses.phoenix.yaml`; macros: `packages/content/data/fusions/phoenix/macros.phoenix.yaml`.

## Skills (33)

### `strike.phoenix` — Firebrand Talon
- Strike · cost S · cooldown 0 · target **any** · tags Radiant, NonStrategic
- Gives target unit Firebrand for 2 turns. An enemy takes 10 damage, then 10 Affliction damage each time they use a skill meanwhile; an ally heals 10, then heals 10 more each time they use a skill meanwhile.
- inline statuses: firebrand, firebrand_mend · ops: if, damage, apply, heal
  - inline `firebrand` (Debuff; triggers: skillUsed): Each skill the bearer uses deals them 10 Affliction damage.
  - inline `firebrand_mend` (Buff; triggers: skillUsed): Each skill the bearer uses heals them 10.

### `smash.phoenix` — Pyre Plunge
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- The user loses up to 40 HP, never going below 1. Target enemy takes that much damage, and each of their allies half as much. The user gains Rebirth for 1 turn.
- applies: rebirth · ops: set, damage, if, apply

### `charge.phoenix` — Rising Dive
- Charge · cost S · cooldown 2 · target **any** · tags Radiant, NonStrategic
- Deals 15 damage to target enemy, or heals target ally 15. The user gains Rebirth until their next skill lands (for up to 2 turns); if it's still unspent then, that skill also deals 15 more damage to its first target if they're an enemy, or heals them 15 more if they're an ally.
- applies: ashes · inline statuses: rising_dive · ops: if, damage, heal, apply, removeSelf, forEach
  - inline `rising_dive` (Buff; triggers: damaged, skillResolved): Rebirth until the bearer's next skill lands; unspent, that skill deals 15 more to its enemy target or heals its ally target 15 more.

### `riposte.phoenix` — Searing Rebuttal
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. If its user is Ignited, their Ignite burns once immediately, and the user is Anointed until the end of their next turn. Invisible.
- applies: anointed · inline statuses: searing_rebuttal · macros: ignite_tick · ops: apply, if, forEach, macro
  - inline `searing_rebuttal` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; if its user is Ignited, their Ignite burns once.

### `rage.phoenix` — Pyreheart Fury
- Rage · cost SA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, each enemy the user deals direct damage to is Ignited, and the user's direct damage is 5 more for each Ignited enemy.
- applies: ignite · inline statuses: pyreheart_fury · ops: apply
  - inline `pyreheart_fury` (Buff; triggers: dealtDamage): Direct hits Ignite their enemy target and deal 5 more per Ignited enemy.

### `shot.phoenix` — Ember Shot
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. For 1 turn, the next direct hit they take from the user's side deals 10 more and Ignites them.
- applies: ignite · inline statuses: lodged_ember · ops: damage, apply
  - inline `lodged_ember` (Debuff; triggers: damaged): The next direct hit from the applier's side deals 10 more and Ignites the bearer.

### `snipe.phoenix` — Sunfall Lance
- Snipe · cost Srr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 35 damage to target enemy and 15 to each of their allies. The target of this skill is invisible. Channeled.
- inline statuses: sunfall_lance · ops: apply, forEach, damage
  - inline `sunfall_lance` (Neutral): At the end of the following turn, deals 35 damage to its target and 15 to each of their allies.

### `trap.phoenix` — Smoldering Nest
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy kills a unit or sends one to Ashes, they take 25 damage and are Ignited. Invisible.
- applies: ignite · inline statuses: smoldering_nest · ops: apply, if, removeSelf, damage
  - inline `smoldering_nest` (Debuff, hidden; triggers: dealtDamage): The first time the bearer kills a unit or sends one to Ashes, they take 25 damage and are Ignited.

### `maneuver.phoenix` — Banked Embers
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- Until the start of their next turn, the user is Untargetable by allies and enemies alike and can't lose HP.
- inline statuses: banked_embers · ops: apply, removeSelf
  - inline `banked_embers` (Neutral; triggers: turnStart): Untargetable by everyone and can't lose HP until the start of the bearer's next turn.

### `companion.phoenix` — Phoenix Chick
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Phoenix Chick (15 HP) permanently. Peck (r): 10 damage and Ignite. The first time it dies, it's replaced at the end of your next turn by a Firebird (30 HP) whose Peck deals 20.
- summons: phoenix_chick · ops: summon

### `bolt.phoenix` — Flare of Mercy
- Bolt · cost Sr · cooldown 1 · target **any** · tags Radiant, NonStrategic
- Kindle: 20 damage and Ignite to target enemy, or 20 healing and 2 Renew to target ally. An ally it mends also loses 1 Debuff.
- macros: kindle · ops: set, macro, if, removeRandom

### `blast.phoenix` — Cleansing Fire
- Blast · cost IW · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies, and they lose all their Buffs. Then every ally of the user, the user included, loses all their Debuffs.
- ops: damage, removeKind

### `consume.phoenix` — Draw the Flame
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If they still have more HP than the user, the user heals half the difference (at most 25).
- ops: damage, set, if, heal

### `summon.phoenix` — Ember Spirit
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Ember Spirit (20 HP) for 3 turns. Waver (r): Kindle, 15 damage and Ignite to target enemy, or 15 healing and 2 Renew to target ally.
- summons: ember_spirit · ops: summon

### `channel.phoenix` — Eternal Pyre
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, deals damage to all enemies: 5, then 10, then 15. Channeled.
- inline statuses: eternal_pyre · ops: apply, damage, addStacksSelf
  - inline `eternal_pyre` (Neutral; triggers: turnEnd): Each turn, deals damage to all enemies, 5 more than the turn before (5, 10, 15).

### `stab.phoenix` — Cautery Needle
- Stab · cost r · cooldown 0 · target **any** · tags Radiant, NonStrategic
- On target enemy: deals 15 damage, and they can't be healed until the end of their next turn. On target ally: removes up to 2 of their Debuffs, and they lose 10 HP for each (never below 1).
- inline statuses: seared_shut · ops: if, damage, apply, repeat, removeRandom
  - inline `seared_shut` (Debuff): Can't be healed.

### `ravage.phoenix` — Pyre Talon
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy, plus 5 for every 10 HP the user is missing (at most 30 more).
- ops: set, damage

### `mislead.phoenix` — Flaring Feint
- Mislead · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and their Ignite burns three times at once. Invisible.
- inline statuses: flaring_feint · macros: ignite_tick · ops: apply, forEach, repeat, macro
  - inline `flaring_feint` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered and their Ignite burns three times.

### `stun.phoenix` — Cinder Shroud
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Stuns them for 2 turns. While they're Stunned, they can't lose HP.
- applies: stun · inline statuses: cinder_shroud · ops: damage, apply
  - inline `cinder_shroud` (Debuff): While the bearer is Stunned, they can't lose HP.

### `dance.phoenix` — Dance of Embers
- Dance · cost AW · cooldown 5 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 2 Swiftness, and each skill they use meanwhile adds 1 stack to this. When it ends, each stack deals 10 damage to every enemy and heals every ally 5.
- applies: swiftness · inline statuses: dance_of_embers · ops: apply, setCounter, repeat, damage, heal
  - inline `dance_of_embers` (Buff; triggers: skillUsed): Each skill the bearer uses adds 1 stack; when this ends, each stack deals 10 damage to every enemy and heals every ally 5.

### `heal.phoenix` — Sacrificial Flame
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- The user loses up to 30 HP, never going below 1. Target ally heals twice as much as the user lost.
- ops: set, damage, heal

### `bless.phoenix` — Phoenix Blessing
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might and Rebirth. If the Rebirth is still unused when this ends, they heal 25.
- applies: might, ashes · inline statuses: phoenix_blessing · ops: apply, if, removeSelf, heal
  - inline `phoenix_blessing` (Buff; triggers: damaged): When the bearer would die, they gain Ashes instead. If unused, it heals the bearer 25 when it ends.

### `curse.phoenix` — Cinders of Doubt
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Ignites target enemy. For 3 turns, at the end of each of the user's turns, if they're still Ignited, they gain 1 Weakness or 1 Vulnerable for 1 turn, or 1 Confusion, at random.
- applies: ignite, weakness, vulnerable, confusion · inline statuses: cinders_of_doubt · ops: apply, if, random
  - inline `cinders_of_doubt` (Debuff; triggers: turnEnd): At the end of each of the applier's turns, if the bearer is Ignited, they gain 1 Weakness or 1 Vulnerable for 1 turn, or 1 Confusion, at random.

### `smite.phoenix` — Sanctified Pyre
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and gives them Sanctified Pyre for 1 turn: it counts as Sanctify, but instead of healing their attackers, it counts each direct hit they take. When it ends, they take 15 Affliction damage per hit.
- inline statuses: sanctified_pyre · ops: damage, apply, addStacksSelf
  - inline `sanctified_pyre` (Debuff; triggers: damaged): Counts as Sanctify. Counts each direct hit the bearer takes; when it ends, the bearer takes 15 Affliction damage per hit.

### `prayer.phoenix` — Second Dawn
- Prayer · cost Wrr · cooldown 5 · target **allAllies** · tags Helpful, Strategic
- Every fallen ally of the user returns with 20 HP and no Buffs or Debuffs. Then all allies heal 15.
- ops: revive, heal

### `cleave.phoenix` — Fanned Flames
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy. For 1 turn, each direct hit either of them takes also deals 5 damage to the other.
- inline statuses: fanned_flames · ops: damage, forEach, apply
  - inline `fanned_flames` (Debuff; triggers: damaged): Each direct hit on the bearer deals 5 damage to the unit they're linked to.

### `shout.phoenix` — Phoenix Cry
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For 2 turns, each enemy who deals direct damage to an ally of the user is Ignited, and the ally they hurt gains 1 Renew.
- applies: ignite, renew · inline statuses: phoenix_cry · ops: apply
  - inline `phoenix_cry` (Debuff; triggers: dealtDamage): Each direct hit the bearer lands on the applier's side Ignites them and gives the one hit 1 Renew.

### `withstand.phoenix` — Cocoon of Flame
- Withstand · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 40 Shield and can't act on their next turn. When the Shield ends, the user and every ally heal as much as it has left.
- inline statuses: cocoon_of_flame, cocooned · ops: apply, heal
  - inline `cocoon_of_flame` (Buff): A Shield; when it ends, everyone on the bearer's side heals what's left of it.
  - inline `cocooned` (Neutral): Can't act until Cocoon of Flame ends.

### `taunt.phoenix` — Blazing Challenge
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 1 turn. Each time they hit the user meanwhile, every other ally of the user heals 10.
- applies: taunt · inline statuses: blazing_challenge · ops: apply, if, heal
  - inline `blazing_challenge` (Buff; triggers: damaged): Each hit from the Taunted enemy heals every other ally of the bearer 10.

### `titan.phoenix` — Undying Phoenix
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune, and each direct hit they take gives them 1 Renew for every 10 damage, up to 3 Renew at a time.
- applies: immune, renew · inline statuses: undying_phoenix · ops: apply, set, if
  - inline `undying_phoenix` (Buff; triggers: damaged): Each direct hit on the bearer gives them 1 Renew per 10 damage, up to 3 Renew at a time.

### `phoenix_chick_peck` — Peck (minion skill of `phoenix_chick`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Ignites them.
- applies: ignite · ops: damage, apply

### `firebird_peck` — Peck (minion skill of `firebird`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Ignites them.
- applies: ignite · ops: damage, apply

### `ember_spirit_waver` — Waver (minion skill of `ember_spirit`)
- Minion · cost r · cooldown 0 · target **any** · tags Radiant, NonStrategic
- Kindle: 15 damage and Ignite to target enemy, or 15 healing and 2 Renew to target ally.
- macros: kindle · ops: set, macro

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `phoenix_chick` — Phoenix Chick, 15 HP; skills: phoenix_chick_peck
- `firebird` — Firebird, 30 HP; skills: firebird_peck
- `ember_spirit` — Ember Spirit, 20 HP; skills: ember_spirit_waver

## Named statuses defined here (2) — this group owns their default animations

- `rebirth` — Rebirth (Buff; triggers: damaged): When the bearer would die, they gain Ashes instead, and Rebirth ends. _Applied by skills in: phoenix._
- `ashes` — Ashes (Neutral; triggers: turnStart): Until the start of the bearer's next turn, they're Untargetable and can't lose HP. Then, if they have less than 25 HP, they go back up to 25 HP. _Applied by skills in: phoenix._

## Macros defined here (2) — this group owns their default animations

- `rise`: ops if, removeEffect, heal. _Used by: none directly._
- `kindle`: ops if, damage, apply, heal; applies ignite, renew. _Used by: phoenix._
