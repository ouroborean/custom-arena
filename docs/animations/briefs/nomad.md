# Nomad — animation brief

Group id: `nomad`. Element(s): Wind + Earth. Concept file: `docs/animations/concepts/nomad.yaml`.
Skill source: `packages/content/data/fusions/nomad/skills.nomad.yaml`; minions: `packages/content/data/fusions/nomad/minions.nomad.yaml`; statuses: `packages/content/data/fusions/nomad/statuses.nomad.yaml`; macros: `packages/content/data/fusions/nomad/macros.nomad.yaml`.

## Skills (31)

### `strike.nomad` — Wayfarer's Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user spends all their Trek for 10 more per Trek spent.
- ops: damage, removeEffect

### `smash.nomad` — Dune Crash
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to their allies. At 3 Trek, each enemy hit also loses their mobility buffs and is Isolated for 1 turn.
- applies: isolated · ops: damage, if, removeEffect, apply

### `charge.nomad` — Break Camp
- Charge · cost free · cooldown 1 · target **self** · tags Helpful, Strategic
- The user begins Rushing. If they have an allied Boulder or Seedling, one of them is removed, and the user gains 2 Trek.
- applies: rushing · macros: gain_trek · ops: apply, forEach, kill, macro

### `riposte.nomad` — Stone and Sand
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user is Taunted for 1 turn by a Boulder the user creates. Invisible.
- applies: taunt · inline statuses: stone_and_sand · summons: boulder · ops: apply, summon
  - inline `stone_and_sand` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer and Taunts its user toward a Boulder.

### `rage.nomad` — Wanderlust
- Rage · cost W · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune, and each time their Trek rises they gain 1 Might, which lasts until their Trek next resets.
- applies: immune · inline statuses: wanderlust, wanderlust_might · ops: apply, if, removeSelf
  - inline `wanderlust` (Buff; triggers: signal): Each Trek gained also gives 1 Might until the Trek resets.
  - inline `wanderlust_might` (Buff; triggers: signal): +5 direct damage until the bearer's Trek resets.

### `shot.nomad` — Sling Stone
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, +5 for each of the user's turns since they last used it (up to +15).
- ops: set, damage, setCounter

### `snipe.nomad` — Haboob
- Snipe · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- On the following turn, deals 20, then 25, then 30 Piercing damage, each time to a random enemy, never the same enemy twice in a row; once there's no other enemy left to hit, it stops. Channeled.
- applies: haboob_trail · inline statuses: haboob · ops: apply, forEach, damage, removeEffect
  - inline `haboob` (Neutral): At the end of the following turn, strikes a random enemy for 20, 25, then 30 Piercing, never the same one twice in a row.

### `trap.nomad` — Sinking Sands
- Trap · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, if target enemy uses the same skill on two of their turns in a row, at the end of the user's next turn they take 25 damage and are Stunned for 1 turn. Invisible.
- applies: stun · inline statuses: sinking_sands · ops: setCounter, apply, if, damage, removeSelf
  - inline `sinking_sands` (Debuff, hidden; triggers: turnEnd): If the bearer uses the same skill on two of their turns in a row, at the end of the applier's next turn they take 25 damage and are Stunned for 1 turn.

### `maneuver.nomad` — Dune Leap
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user's other ally with the least HP Leaps, and the user's Trek rises by 1. With no other ally, the user Leaps instead.
- macros: leap, gain_trek · ops: if, forEach, macro

### `companion.nomad` — Pack Camel
- Companion · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Pack Camel (50 HP) permanently; while it stands, a turn in which the user uses no skill doesn't reset their Trek. Kick (r): 15 damage.
- summons: pack_camel · ops: summon

### `bolt.nomad` — Tent Stake
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, they lose all their mobility buffs, can't gain any, and are Immobile.
- inline statuses: tent_stake · macros: remove_mobility · ops: damage, macro, apply
  - inline `tent_stake` (Debuff): Immobile, and can't gain mobility buffs.

### `blast.nomad` — Dust Devil
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies; each one hit loses 1 mobility buff, and the user gains 1 Trek per buff removed.
- macros: gain_trek · ops: damage, forEach, if, removeEffect, removeStacks, macro

### `consume.nomad` — Road Toll
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. The first skill they use before the user's next turn costs 1 more random energy, and the user heals 20 when they use it.
- inline statuses: road_toll · ops: damage, apply, heal
  - inline `road_toll` (Debuff; triggers: skillUsed): The bearer's next skill costs 1 more random energy; using it heals the applier 20.

### `summon.nomad` — Pack Mule
- Summon · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Pack Mule (25 HP) for 3 turns. At the end of each of the user's turns, it stores 1 unspent energy (max 3); when it leaves, the user's player gets it all back.
- summons: pack_mule · ops: summon

### `channel.nomad` — The Long Road
- Channel · cost Ir · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- At the end of each of the user's turns, deals 10 damage to all enemies; it continues only while their Trek keeps rising, up to 4 turns. Channeled, but the user's other skills don't end it.
- inline statuses: the_long_road · ops: setCounter, apply, damage, if, removeSelf
  - inline `the_long_road` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies, while the bearer's Trek keeps rising.

### `stab.nomad` — Traveler's Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, 15 if the user also used it on their last turn, and 20 if on their last two. Repeating it resets the user's Trek.
- ops: if, setCounter, damage

### `ravage.nomad` — Scour
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- The user gives up all their mobility buffs; then 25 Piercing damage to target enemy, +10 for each one given up.
- ops: set, removeEffect, damage

### `mislead.nomad` — Mirage
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 4 turns, target enemy's next Harmful skill is countered, the one after lands, the one after that is countered, and so on. Invisible.
- applies: mirage · ops: apply

### `stun.nomad` — Grit in the Eyes
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Stuns them for 2 turns; the Stun ends as soon as an enemy damages the user.
- inline statuses: grit_in_the_eyes, grit_watch · ops: damage, apply, removeEffect, removeSelf
  - inline `grit_in_the_eyes` (Debuff): Cannot use skills; ends early if an enemy damages the applier.
  - inline `grit_watch` (Neutral; triggers: damaged): If an enemy damages the bearer, the Stun on their target ends.

### `dance.nomad` — Endless Journey
- Dance · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user's Trek can't reset; while it's at 3, their skills cost 1 less.
- inline statuses: endless_journey · ops: apply
  - inline `endless_journey` (Buff): Trek can't reset; at 3 Trek, skills cost 1 less.

### `heal.nomad` — Waterskin
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15, and 10 more at the end of each of their next 2 turns in which they use a skill.
- inline statuses: waterskin · ops: heal, setCounter, apply, if
  - inline `waterskin` (Buff; triggers: turnEnd): Heals 10 at the end of each of the bearer's turns in which they use a skill.

### `bless.nomad` — Cairn Blessing
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Might for 3 turns. Each time they use a mobility skill meanwhile, the user creates a Boulder.
- applies: might · inline statuses: cairn_blessing · summons: boulder · ops: apply, summon
  - inline `cairn_blessing` (Buff; triggers: skillUsed): Each mobility skill the bearer uses creates a Boulder for the applier.

### `curse.nomad` — Dust in the Wind
- Curse · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Confusion for 2 turns. If the user has an allied Boulder, it's removed, the target gains 1 more Confusion, and the user Leaps.
- applies: confusion · macros: leap · ops: apply, forEach, kill, macro

### `smite.nomad` — Waymarker
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Until the user's Trek next resets (up to 3 turns), allies who damage them heal 10.
- inline statuses: waymarker · ops: damage, apply, heal, if, removeSelf
  - inline `waymarker` (Debuff; triggers: damaged, signal): The applier's allies who damage the bearer heal 10, until the applier's Trek resets.

### `prayer.nomad` — Campfire Song
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and gain 10 Shield for 1 turn. The user's Trek resets, and allies heal 10 more per Trek it had.
- applies: shield · macros: reset_trek · ops: set, heal, apply, forEach, macro

### `cleave.nomad` — Sweeping Sands
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For up to 3 turns, the next time the user's Trek resets, a random other enemy takes 30 damage.
- inline statuses: buried_in_sand · ops: damage, apply, if, removeSelf
  - inline `buried_in_sand` (Debuff; triggers: signal): When the applier's Trek next resets, the bearer takes 30 damage.

### `shout.nomad` — Call of the Caravan
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For 2 turns, all enemies deal 10 less direct damage to units with Trek or a mobility buff.
- inline statuses: caravan_dust · ops: apply
  - inline `caravan_dust` (Debuff): Deals 10 less direct damage to units with Trek or a mobility buff.

### `withstand.nomad` — Rolling Dune
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 15 Shield for 2 turns; it grows by 10 each time their Trek rises.
- applies: rolling_dune · ops: apply

### `taunt.nomad` — Challenge in the Sand
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for up to 2 turns. The first time they damage the user, the Taunt ends and the user Leaps.
- applies: taunt · inline statuses: challenge_in_the_sand · macros: leap · ops: apply, if, removeEffect, forEach, macro, removeSelf
  - inline `challenge_in_the_sand` (Buff; triggers: damaged): When the Taunted enemy first damages the bearer, their Taunt ends and the bearer Leaps.

### `titan.nomad` — Colossus of the Dunes
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 3 Armor and Immune and their Trek is frozen, but they're Immobile: they lose their mobility buffs and can't gain any.
- applies: armor, immune · inline statuses: dune_colossus · ops: apply, removeEffect
  - inline `dune_colossus` (Buff): Trek frozen; Immobile, and can't gain mobility buffs.

### `pack_camel_kick` — Kick (minion skill of `pack_camel`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `pack_camel` — Pack Camel, 50 HP; skills: pack_camel_kick
- `pack_mule` — Pack Mule, 25 HP; skills: none
  - passive `pack_mule_saddlebags` (triggers: turnEnd): At the end of its owner's turn, stores 1 unspent energy (max 3); its owner gets it back when it leaves.

## Named statuses defined here (6) — this group owns their default animations

- `trek` — Trek (Neutral): Max 3. +1 at the end of each of the bearer's turns in which they used a different skill than on their previous turn; repeating a skill, or using none, resets it. _Applied by skills in: none directly._
- `nomad_trek` — Wanderer (Neutral; triggers: turnEnd): Tracks this character's Trek. _Applied by skills in: none directly._
- `mirage` — Mirage (Debuff; triggers: skillUsed/counter): The bearer's next Harmful skill is countered; the one after lands. _Applied by skills in: nomad._
- `mirage_lull` — Mirage (Debuff; triggers: skillResolved): The bearer's next Harmful skill lands; the one after is countered. _Applied by skills in: none directly._
- `rolling_dune` — Rolling Dune (Buff; triggers: signal): A Shield that grows by 10 each time the bearer's Trek rises. _Applied by skills in: nomad._
- `haboob_trail` — Haboob (Neutral): The bearer took the last hit; the next hit goes to a different enemy. _Applied by skills in: nomad._

## Macros defined here (2) — this group owns their default animations

- `gain_trek`: ops apply, setCounter, signal; applies trek. _Used by: nomad._
- `reset_trek`: ops if, removeEffect, signal. _Used by: nomad._
