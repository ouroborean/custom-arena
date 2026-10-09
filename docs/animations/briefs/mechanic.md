# Mechanic — animation brief

Group id: `mechanic`. Element(s): Fire + Wind. Concept file: `docs/animations/concepts/mechanic.yaml`.
Skill source: `packages/content/data/fusions/mechanic/skills.mechanic.yaml`; minions: `packages/content/data/fusions/mechanic/minions.mechanic.yaml`; statuses: `packages/content/data/fusions/mechanic/statuses.mechanic.yaml`; macros: `packages/content/data/fusions/mechanic/macros.mechanic.yaml`.

## Skills (30)

### `strike.mechanic` — Piston Punch
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, and a random allied minion is Upgraded.
- macros: upgrade_random · ops: damage, macro

### `smash.mechanic` — Steam Hammer
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies. If the user is Rushing, their Rushing ends, and their allies take 30 instead and are Ignited.
- applies: ignite · ops: damage, if, removeEffect, apply

### `charge.mechanic` — Rocket Boots
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user begins Rushing and builds a Turret for 2 turns.
- applies: rushing · summons: turret · ops: damage, apply, summon

### `riposte.mechanic` — Spring Trap
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user is Isolated for 1 turn, and the user builds a Turret. Invisible.
- applies: isolated · inline statuses: spring_trap · summons: turret · ops: apply, summon
  - inline `spring_trap` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, Isolates its user, and builds a Turret.

### `rage.mechanic` — Boiler Fury
- Rage · cost A · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Immune, and 1 more Might each time their side causes an Explosion (max 3 more).
- applies: might, immune · inline statuses: boiler_fury · ops: apply, setCounter, if
  - inline `boiler_fury` (Buff; triggers: signal): Each Explosion the bearer's side causes gives 1 more Might while this lasts (max 3).

### `shot.mechanic` — Rivet Gun
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the last one to damage them was an allied minion, that minion is Upgraded.
- macros: upgrade · ops: forEach, macro, damage

### `snipe.mechanic` — Mortar
- Snipe · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- The user builds a Mortar (Contraption, 20 HP). On the following turn, if it still stands, it fires: 25 Piercing damage to all enemies. Channeled.
- inline statuses: mortar_shell · summons: mortar · ops: summon, apply, forEach, damage
  - inline `mortar_shell` (Neutral): The Mortar fires at the end of the following turn if it still stands.

### `trap.mechanic` — Tripwire
- Trap · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first skill target enemy uses Ignites them; after that, their Ignite also ticks each time they use a skill. Invisible.
- applies: ignite · inline statuses: tripwire · ops: apply, if, damage, setFlag
  - inline `tripwire` (Debuff, hidden; triggers: skillUsed): The bearer's first skill Ignites them; after that, each skill makes their Ignite tick.

### `maneuver.mechanic` — Jetpack
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 2 turns, but they can't use skills on their next turn. When it ends, they cause an Explosion.
- applies: invulnerable · inline statuses: jetpack_airborne, jetpack · macros: explode · ops: apply, macro
  - inline `jetpack_airborne` (Neutral): Can't use skills.
  - inline `jetpack` (Neutral): When this ends, the bearer causes an Explosion.

### `companion.mechanic` — Clockwork Hound
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Builds a Clockwork Hound (Contraption, 30 HP) permanently. At the end of each of your turns, it deals 10 damage to a random enemy, and every other turn it Upgrades itself.
- summons: clockwork_hound · ops: summon

### `bolt.mechanic` — Grapnel Shot
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Marks them for 1 turn. Until the end of their next turn, they lose Invulnerable, Untargetable and Stealth, and can't gain them.
- applies: mark · inline statuses: grapnel_hook · ops: damage, apply, removeEffect
  - inline `grapnel_hook` (Debuff): Can't gain Invulnerable, Untargetable or Stealth.

### `blast.mechanic` — Pressure Cascade
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, +10 for each ally of the user who used a skill earlier this turn.
- ops: damage

### `consume.mechanic` — Refuel
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, healing the user as much. The user spends all their Swiftness: 10 more healing per stack.
- ops: damage, heal, removeEffect

### `summon.mechanic` — Turret Drop
- Summon · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- Builds 2 Turrets for 3 turns. When one is destroyed, the other is Upgraded.
- summons: paired_turret · ops: summon

### `channel.mechanic` — Assembly Line
- Channel · cost SI · cooldown 3 · target **self** · tags Helpful, Strategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, a random allied minion is Upgraded; if the user has none, they build a Turret instead. Channeled.
- inline statuses: assembly_line · macros: upgrade_random · summons: turret · ops: apply, if, macro, summon
  - inline `assembly_line` (Neutral; triggers: turnEnd): Each turn, Upgrades a random allied minion, or builds a Turret if there are none.

### `stab.mechanic` — Drill Bit
- Stab · cost free · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, UsableWhileStunned
- Deals 10 damage to target enemy, 5 more for each earlier Drill Bit still in them (up to 10 more). Usable while Stunned.
- inline statuses: drill_hole · ops: damage, apply
  - inline `drill_hole` (Debuff): Each Drill Bit in the bearer makes the next one deal 5 more (up to 10).

### `ravage.mechanic` — Chainsaw
- Ravage · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals Piercing damage to target enemy equal to a third of their current HP (at least 10, at most 25).
- ops: set, damage

### `mislead.mechanic` — Dummy Bomb
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and a Dummy (Contraption, 15 HP) is built. When the Dummy is destroyed, it Explodes. Invisible.
- inline statuses: dummy_bomb · summons: dummy · ops: apply, summon
  - inline `dummy_bomb` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and a Dummy is built.

### `stun.mechanic` — Concussion Grenade
- Stun · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- At the start of the user's next turn, target enemy takes 15 damage and is Stunned for 1 turn, unless they used a mobility skill in between.
- applies: stun · inline statuses: concussion_grenade · ops: apply, removeSelf, damage
  - inline `concussion_grenade` (Debuff; triggers: skillUsed): At the start of the applier's next turn, the bearer takes 15 damage and is Stunned for 1 turn, unless they use a mobility skill first.

### `dance.mechanic` — Overclock
- Dance · cost AA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, and at the end of each of their turns, their cooldowns tick down 1 extra turn and they take 5 Affliction damage.
- applies: might · inline statuses: overclock · ops: apply, damage
  - inline `overclock` (Buff; triggers: turnEnd): At the end of each of the bearer's turns, their cooldowns tick down 1 extra turn and they take 5 Affliction damage.

### `heal.mechanic` — Repair Kit
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. An allied minion is instead Upgraded twice; a Contraption is Repaired for 20 first.
- macros: upgrade · ops: if, heal, forEach, macro

### `bless.mechanic` — Tune-Up
- Bless · cost S · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might, and their damaging skills don't end their Leap; it ends only when they take damage.
- applies: might, leaping · inline statuses: tune_up · ops: apply, if, setFlag, removeEffect
  - inline `tune_up` (Buff; triggers: skillUsed, skillResolved, damaged): The bearer's damaging skills don't end their Leap; taking damage does.

### `curse.mechanic` — Sabotage
- Curse · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns. Meanwhile, each mobility skill they use is countered, and they're Stunned for 1 turn.
- applies: confusion, stun · inline statuses: sabotage · ops: apply
  - inline `sabotage` (Debuff; triggers: skillUsed/counter): Each mobility skill the bearer uses is countered and Stuns them for 1 turn.

### `smite.mechanic` — Signal Flare
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each allied minion that damages them is Upgraded.
- inline statuses: signal_flare · macros: upgrade · ops: damage, apply, forEach, macro
  - inline `signal_flare` (Debuff; triggers: damaged): Each of the applier's minions that damages the bearer is Upgraded.

### `prayer.mechanic` — Field Workshop
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. Each ally at or below half HP afterwards gets a Turret for 2 turns.
- summons: turret · ops: heal, forEach, summon

### `cleave.mechanic` — Red-Hot Blades
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to a random other enemy. The user is Ignited, and deals 5 more direct damage while they stay Ignited.
- applies: ignite · inline statuses: red_hot_blades · ops: damage, apply, if, removeSelf
  - inline `red_hot_blades` (Buff; triggers: turnStart): +5 direct damage while the bearer is Ignited.

### `shout.mechanic` — Steam Whistle
- Shout · cost S · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Every allied minion is Upgraded, and loses that level again after 2 turns.
- applies: intimidated · inline statuses: steam_whistle · macros: upgrade · ops: apply, forEach, if, macro, removeStacks, addMaxHp
  - inline `steam_whistle` (Neutral): Loses the Upgrade level it gave when this ends.

### `withstand.mechanic` — Blast Shield
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. When it ends, if 10 or more is left, the user builds a Turret for 2 turns.
- inline statuses: blast_shield · summons: turret · ops: apply, if, summon
  - inline `blast_shield` (Buff): A Shield; with 10 or more left when it ends, the bearer builds a Turret.

### `taunt.mechanic` — Scarecrow Bot
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Builds a Decoy (Contraption, 20 HP); target enemy is Taunted by it for 2 turns, or 3 if they're Immobile.
- applies: taunt · summons: decoy · ops: summon, apply

### `titan.mechanic` — Mech Suit
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune and counts as a Contraption: they ignore Stuns and Sleep and can't be healed, and they're Upgraded now and at the start of each of their turns. When it ends, they lose those Upgrades.
- applies: immune · inline statuses: mech_suit · macros: upgrade · ops: apply, forEach, macro, addMaxHp, removeEffect
  - inline `mech_suit` (Buff; triggers: turnStart): Counts as a Contraption that can be Upgraded; ignores Stuns, can't be healed, and is Upgraded at the start of each of the bearer's turns. The bearer loses those Upgrades when this ends.

## Minions (6)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `turret` — Turret, 20 HP; skills: none
  - passive `contraption`: A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion.
  - passive `turret_fire` (triggers: turnEnd): At the end of its owner's turn, deals 10 damage to a random enemy.
- `paired_turret` — Turret, 20 HP; skills: none
  - passive `contraption`: A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion.
  - passive `paired_turret_fire` (triggers: turnEnd): At the end of its owner's turn, deals 10 damage to a random enemy. When it's destroyed, its partner is Upgraded.
- `mortar` — Mortar, 20 HP; skills: none
  - passive `contraption`: A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion.
- `clockwork_hound` — Clockwork Hound, 30 HP; skills: none
  - passive `contraption`: A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion.
  - passive `clockwork_hound_hunt` (triggers: turnEnd): At the end of its owner's turn, deals 10 damage to a random enemy; every other turn it Upgrades itself.
- `dummy` — Dummy, 15 HP; skills: none
  - passive `contraption`: A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion.
- `decoy` — Decoy, 20 HP; skills: none
  - passive `contraption`: A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion.

## Named statuses defined here (2) — this group owns their default animations

- `contraption` — Contraption (Neutral): A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion. _Applied by skills in: none directly._
- `upgraded` — Upgrade (Neutral): Upgrade level (max 3). +5 damage per level (each level also gave +10 max HP). _Applied by skills in: none directly._

## Macros defined here (3) — this group owns their default animations

- `upgrade`: ops if, apply, addMaxHp, heal; applies upgraded. _Used by: mechanic._
- `upgrade_random`: ops forEach, macro. _Used by: mechanic._
- `upgrade_all`: ops forEach, macro. _Used by: none directly._
