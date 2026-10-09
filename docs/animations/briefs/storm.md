# Storm — animation brief

Group id: `storm`. Element(s): Lightning + Wind. Concept file: `docs/animations/concepts/storm.yaml`.
Skill source: `packages/content/data/fusions/storm/skills.storm.yaml`; minions: `packages/content/data/fusions/storm/minions.storm.yaml`; statuses: `packages/content/data/fusions/storm/statuses.storm.yaml`; macros: `packages/content/data/fusions/storm/macros.storm.yaml`.

## Skills (33)

### `strike.storm` — Squall Strike
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, +5 per Tempest the user has (max +15).
- ops: damage

### `smash.storm` — Spider Lightning
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, then hits their allies one at a time, 10 more with each hit (up to 30). Each of those hits spends 1 of the user's Tempest; they stop once there's none left.
- inline statuses: spider_lightning · ops: damage, set, repeat, if, forEach, removeStacks, apply
  - inline `spider_lightning` (Neutral, hidden): Already struck by this Spider Lightning.

### `charge.storm` — Ride the Wind
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user's next Harmful skill also deals 5 damage per Tempest to a random other enemy.
- inline statuses: ride_the_wind · ops: damage, apply, if
  - inline `ride_the_wind` (Buff; triggers: skillResolved): The bearer's next Harmful skill also deals 5 damage per Tempest to a random other enemy.

### `riposte.storm` — Grounded Arc
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user is Sapped once for each energy it cost. Invisible.
- applies: sapped · inline statuses: grounded_arc · ops: apply
  - inline `grounded_arc` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user is Sapped once for each energy it cost.

### `rage.storm` — Storm Within
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, each Harmful Storm skill the user uses that leaves an enemy untargeted spends 1 Tempest to deal 10 damage to every enemy it didn't target.
- inline statuses: storm_within · ops: apply, if, removeStacks, damage
  - inline `storm_within` (Buff; triggers: skillResolved): Each Harmful Storm skill the bearer uses that leaves an enemy untargeted spends 1 Tempest to deal 10 damage to every enemy it didn't target.

### `shot.storm` — Shared Static
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. Until the user's next turn, each time one of their allies takes damage, the user gains 1 Charge.
- applies: charged · inline statuses: shared_static · ops: damage, apply
  - inline `shared_static` (Buff; triggers: damaged): Damage to the bearer gives the applier 1 Charge.

### `snipe.storm` — Stormfront
- Snipe · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- On the following turn, deals 15 Piercing damage to all enemies, +5 for each Tempest; it spends all of it. Channeled.
- inline statuses: stormfront · ops: apply, damage, removeEffect
  - inline `stormfront` (Neutral): At the end of the following turn, deals 15 Piercing damage to all enemies, +5 per Tempest, and spends all of it.

### `trap.storm` — Charged Noose
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, each time target enemy uses a skill, the user gains 1 Tempest, and they take 5 Piercing damage per Tempest. Invisible.
- inline statuses: charged_noose · macros: gain_tempest · ops: apply, forEach, macro, damage
  - inline `charged_noose` (Debuff, hidden; triggers: skillUsed): Each skill the bearer uses gives the applier 1 Tempest and deals the bearer 5 Piercing damage per Tempest.

### `maneuver.storm` — Into the Eye
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user's Tempest rises to 3 if it's lower. For 2 turns, while it's 3 or more, enemies' single-target skills can't target them; only skills that hit their whole side can.
- inline statuses: into_the_eye, eye_wall · macros: gain_tempest · ops: repeat, forEach, macro, apply
  - inline `into_the_eye` (Buff): While the bearer's Tempest is 3 or more, enemies' single-target skills can't target them.
  - inline `eye_wall` (Neutral, hidden): Can't use single-target skills on a unit with Into the Eye while their Tempest is 3 or more.

### `companion.storm` — Storm Roc
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Storm Roc (40 HP) permanently; its skills are Storm skills. Gale Wing (nc): 5 damage to target enemy. Thunder Talon (r, only at 3 or more Tempest): 20 damage, and Saps.
- summons: storm_roc · ops: summon

### `bolt.storm` — Thunderhead
- Bolt · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- The user gains Thunderhead on target enemy until the end of their next turn. Meanwhile, their Tempest doesn't rise; instead, each Storm skill their team uses adds 1 charge to the Thunderhead (max 3). When it ends, the target takes 20 damage, plus 10 per charge.
- inline statuses: thunderhead · ops: apply, if, addStacksSelf, damage
  - inline `thunderhead` (Buff; triggers: signal): The bearer's Tempest doesn't rise; each Storm skill their team uses adds 1 charge to this instead (max 3). When it ends, its target takes 20 damage, plus 10 per charge.

### `blast.storm` — Supercell
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Tempest falls by 1, and each ally gains 1 Charge.
- applies: charged · ops: damage, removeStacks, apply

### `consume.storm` — Calm Before the Storm
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. Tempest falls by up to 2, and the user heals the damage dealt plus 10 for each point it fell.
- ops: damage, set, removeStacks, heal

### `summon.storm` — Brewing Squall
- Summon · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons a Squall Cloud (20 HP) for 3 turns; its skills are Storm skills. Rumble (nc): 5 damage to target enemy. When it expires, it deals 5 damage per Tempest to all enemies.
- summons: squall_cloud · ops: summon

### `channel.storm` — Hurricane
- Channel · cost SI · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 4 turns, at the end of each of the user's turns, deals 10 damage to all enemies, +5 per Tempest, and Tempest rises by 1; it ends early once Tempest reaches 5. Channeled.
- inline statuses: hurricane · macros: gain_tempest · ops: apply, damage, forEach, macro, if, removeSelf
  - inline `hurricane` (Neutral; triggers: turnEnd): Each turn, damage scaling with Tempest, and Tempest rises; ends at 5.

### `stab.storm` — Knife in the Gale
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, then 5 damage per Tempest (max 10) to the enemy with the least HP.
- ops: damage

### `ravage.storm` — Summit Strike
- Ravage · cost A · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic, Bypass
- Deals 25 Piercing damage to the enemy with the most HP, +15 if they're Stunned. It Bypasses.
- ops: damage

### `mislead.storm` — False Front
- Mislead · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and they're Sapped once for every 2 Tempest (at least once). Invisible.
- applies: sapped · inline statuses: false_front · ops: apply
  - inline `false_front` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they're Sapped once for every 2 of the applier's Tempest (at least once).

### `stun.storm` — Static Buildup
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 2 turns, each skill they use adds 1 turn to a Stun they receive when it ends (max 3).
- applies: stun · inline statuses: static_buildup · ops: damage, setCounter, apply, if
  - inline `static_buildup` (Debuff; triggers: skillUsed): Each skill the bearer uses adds 1 turn to a Stun they receive when this ends (max 3 turns).

### `dance.storm` — Storm Rider
- Dance · cost AA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and begins Rushing; while they're Rushing, all their skills count as Storm skills.
- applies: might, rushing · inline statuses: storm_rider · ops: apply, if, signal
  - inline `storm_rider` (Buff; triggers: skillUsed): While Rushing, the bearer's skills count as Storm skills.

### `heal.storm` — Mending Arc
- Heal · cost A · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally heals 25. Then the other ally with the least HP heals 15, and any remaining allies heal 5.
- ops: heal, forEach, setCounter

### `bless.storm` — Tailwind
- Bless · cost S · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 2 turns, target ally's skills count as Storm skills, and they gain 1 Swiftness.
- applies: swiftness · inline statuses: tailwind · ops: apply, if, signal
  - inline `tailwind` (Buff; triggers: skillUsed): The bearer's skills count as Storm skills.

### `curse.storm` — Crosswind
- Curse · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy loses all their Charge. For 2 turns, any Charge they would gain is added to the user's Tempest instead.
- inline statuses: crosswind · macros: gain_tempest · ops: removeEffect, apply, forEach, macro
  - inline `crosswind` (Debuff; triggers: effectGained): Charge the bearer would gain is added to the applier's Tempest instead.

### `smite.storm` — Rod of the Storm
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each time an ally damages them, Tempest rises by 1.
- inline statuses: rod_of_the_storm · macros: gain_tempest · ops: damage, apply, forEach, macro
  - inline `rod_of_the_storm` (Debuff; triggers: damaged): Each hit from the applier's side raises their Tempest.

### `prayer.storm` — Song of the Storm
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield for 1 turn. For 2 turns, the team's Tempest doesn't fall.
- applies: shield · inline statuses: song_of_the_storm · ops: heal, apply
  - inline `song_of_the_storm` (Buff): The bearer's Tempest doesn't fall.

### `cleave.storm` — Shearing Gale
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 5 to every other enemy. For each Tempest beyond the first (max 3 more), it deals 5 less to the target and 5 more to the others.
- ops: set, damage

### `shout.storm` — Storm Warning
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For 2 turns, each time a Storm skill damages an enemy, they're Sapped.
- applies: sapped · inline statuses: storm_warning · ops: apply, if
  - inline `storm_warning` (Debuff; triggers: damaged): Each time a Storm skill damages the bearer, they're Sapped.

### `withstand.storm` — Storm Cellar
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- Every ally, the user included, gains 20 Shield for 1 turn. The user gains 3 Sapped.
- applies: shield, sapped · ops: apply

### `taunt.storm` — Static Lure
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. While they're Taunted and Sapped, they generate 1 less energy every turn.
- applies: taunt · inline statuses: static_lure · ops: apply
  - inline `static_lure` (Debuff): While Taunted and Sapped, the bearer generates 1 less energy each turn.

### `titan.storm` — Djinn of the Tempest
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune and gains 1 Armor per 2 Tempest, rechecked as each hit lands; Tempest rises by 1 at the start of each of their turns.
- applies: immune · inline statuses: djinn_of_the_tempest · macros: gain_tempest · ops: apply, forEach, macro
  - inline `djinn_of_the_tempest` (Buff; triggers: turnStart): 1 Armor per 2 Tempest; Tempest rises each turn.

### `storm_roc_gale_wing` — Gale Wing (minion skill of `storm_roc`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy.
- ops: damage

### `storm_roc_thunder_talon` — Thunder Talon (minion skill of `storm_roc`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Saps them. Only at 3 or more Tempest.
- applies: sapped · ops: damage, apply

### `squall_cloud_rumble` — Rumble (minion skill of `squall_cloud`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `storm_roc` — Storm Roc, 40 HP; skills: storm_roc_gale_wing, storm_roc_thunder_talon
- `squall_cloud` — Squall Cloud, 20 HP; skills: squall_cloud_rumble

## Named statuses defined here (3) — this group owns their default animations

- `tempest` — Tempest (Neutral): Rises as the team uses Storm skills (max 5). At 5, the bearer gains Eye of the Storm. _Applied by skills in: none directly._
- `eye_of_the_storm` — Eye of the Storm (Buff): The bearer's next Storm skill also deals 15 damage to every other enemy, and Tempest drops to 3. _Applied by skills in: none directly._
- `storm_heart` — Storm Heart (Neutral; triggers: signal, turnEnd, skillResolved): +1 Tempest each time the team uses a Storm skill; −1 at the end of each of this character's turns in which none was used. At 5, they gain Eye of the Storm. _Applied by skills in: none directly._

## Macros defined here (1) — this group owns their default animations

- `gain_tempest`: ops apply, if, setCounter; applies tempest, eye_of_the_storm. _Used by: storm._
