# Wind — animation brief

Group id: `wind`. Element(s): Wind. Concept file: `docs/animations/concepts/wind.yaml`.
Skill source: `packages/content/data/wind/skills.wind.yaml`; minions: `packages/content/data/wind/minions.wind.yaml`; statuses: `packages/content/data/wind/statuses.wind.yaml`; macros: `packages/content/data/wind/macros.wind.yaml`.

## Skills (33)

### `strike.wind` — Leaping Strike
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If used while Leaping, also stuns their non-Strategic skills for 1 turn.
- applies: stun_ns · ops: set, damage, if, apply

### `smash.wind` — Spiral Crash
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the user is not Leaping, they Leap. If they are Leaping, this also deals 10 damage to all enemies.
- macros: leap · ops: set, damage, if, forEach, macro

### `charge.wind` — Launch
- Charge · cost free · cooldown 1 · target **self** · tags Helpful, Strategic
- The user begins Rushing.
- applies: rushing · ops: apply

### `riposte.wind` — Zephyr Blade
- Riposte · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy. If this skill is countered, the countering enemy takes 25 Piercing damage.
- ops: damage

### `rage.wind` — Chainbreaker
- Rage · cost A · cooldown 4 · target **self** · tags Helpful, Strategic, UsableWhileStunned
- Removes all Debuffs from the user and makes them Immune for 2 turns. Usable while Stunned.
- applies: immune · ops: removeKind, apply

### `shot.wind` — Air Bullet
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. If the user is Leaping, it deals 10 more; otherwise, they Leap.
- macros: leap · ops: set, damage, if, forEach, macro

### `snipe.wind` — Elegant Sweep
- Snipe · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- The user deals 25 Piercing damage to the enemy team on the following turn. Channeled.
- inline statuses: elegant_sweep · ops: apply, damage
  - inline `elegant_sweep` (Neutral): At the end of the following turn, 25 Piercing damage to every enemy, unless interrupted.

### `trap.wind` — Float Noose
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 2 turns, each time target enemy uses a skill, they are Isolated for 1 turn and take 10 Piercing damage.
- applies: isolated · inline statuses: float_noose · ops: apply, damage
  - inline `float_noose` (Debuff; triggers: skillUsed): Each skill the bearer uses Isolates them for 1 turn and deals them 10 Piercing damage.

### `maneuver.wind` — Bound
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user Leaps.
- macros: leap · ops: forEach, macro

### `companion.wind` — Grand Eagle
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Grand Eagle minion (45 HP). Talon Rake (r): 15 damage to target enemy. Soar (A): the Eagle and target ally Leap.
- summons: grand_eagle · ops: summon

### `bolt.wind` — Compressed Bolt
- Bolt · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If they are Immobile, their non-Strategic skills are stunned for 1 turn.
- applies: stun_ns · ops: damage, if, apply

### `blast.wind` — Spiral Burst
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. If the user is Leaping, it deals 10 more; otherwise, they begin Rushing.
- applies: rushing · ops: set, damage, if, apply

### `consume.wind` — Sap Speed
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and removes all their Mobility buffs. Then, if they are Immobile, the user gains 1 Swiftness.
- applies: swiftness · macros: remove_mobility · ops: damage, macro, if, apply

### `summon.wind` — Summon Wind Sprite
- Summon · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- Summons 2 Wind Sprite minions (10 HP) for 3 turns. Bother (no cost): 5 Piercing damage to target enemy; if it's countered, the countering enemy is Stunned for 1 turn.
- summons: wind_sprite · ops: summon

### `channel.wind` — Vortex
- Channel · cost AI · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Deals 10 damage to all enemies for 2 turns. If the user is Leaping or Rushing when a tick fires, an additional turn is added (once). Channeled.
- inline statuses: vortex · ops: apply, damage, if, extendSelf, setFlag
  - inline `vortex` (Neutral; triggers: turnEnd): Each end of the user's turn, 10 damage to all enemies. Extended once if the user is Leaping or Rushing.

### `stab.wind` — Airknife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, increased to 20 if the user is Rushing. If they aren't, they begin Rushing.
- applies: rushing · ops: set, if, signal, damage, apply

### `ravage.wind` — Sonic Thrust
- Ravage · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. If the user isn't Rushing, they are Stunned for 1 turn.
- applies: stun · ops: damage, if, apply

### `mislead.wind` — Wind Step
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 1 turn, if target enemy uses a Harmful skill, they are Marked and the user begins Rushing.
- applies: mark, rushing · inline statuses: wind_step · ops: apply
  - inline `wind_step` (Debuff; triggers: skillUsed): When the bearer uses a Harmful skill, they are Marked and the caster begins Rushing.

### `stun.wind` — Buffet
- Stun · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and stuns their Strategic skills for 1 turn.
- applies: stun_s · ops: damage, apply

### `dance.wind` — Top Speed
- Dance · cost AI · cooldown 5 · target **self** · tags Helpful, Strategic
- The user gains 1 Might and Ghosted for 3 turns, and begins Rushing.
- applies: might, ghosted, rushing · ops: apply

### `heal.wind` — Invigorating Breeze
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Heals target ally 20 HP. If they are above 60 HP afterwards, they begin Rushing.
- applies: rushing · ops: heal, if, apply

### `bless.wind` — Swiftwind
- Bless · cost A · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 2 Swiftness.
- applies: swiftness · ops: apply

### `curse.wind` — Headwind
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy loses all Mobility buffs and gains 1 Weakness.
- applies: weakness · macros: remove_mobility · ops: macro, apply

### `smite.wind` — Feathermark
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, allies that damage them Leap.
- inline statuses: feathermark · macros: leap · ops: damage, apply, forEach, macro
  - inline `feathermark` (Debuff; triggers: damaged): Units on the applier's side that damage the bearer Leap.

### `prayer.wind` — Uplifting Verse
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- Heals all allies for 15 HP, then every unit in the game Leaps.
- macros: leap · ops: heal, forEach, macro

### `cleave.wind` — Falling Slam
- Cleave · cost Ar · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies. Costs 1 GEN less while the user is Leaping or Rushing.
- ops: damage

### `shout.wind` — Echoing Voice
- Shout · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- Every unit in the game gains 1 Swiftness.
- applies: swiftness · ops: apply

### `withstand.wind` — Slipstream
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 15 Shield, increased by 15 if the user is Rushing.
- applies: shield · ops: apply

### `taunt.wind` — Piercing Cry
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 1 turn, or 3 turns if they are Immobile.
- applies: taunt · ops: apply

### `titan.wind` — Djinnform
- Titan · cost SA · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 15 Shield and Immune for 3 turns, then Leaps.
- applies: shield, immune · macros: leap · ops: apply, forEach, macro

### `eagle_talon_rake` — Talon Rake (minion skill of `grand_eagle`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy.
- ops: damage

### `eagle_soar` — Soar (minion skill of `grand_eagle`)
- Minion · cost A · cooldown 0 · target **ally** · tags Helpful, Strategic
- The Eagle and target ally Leap.
- macros: leap · ops: forEach, macro

### `sprite_bother` — Bother (minion skill of `wind_sprite`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy. If this is countered, the countering enemy is Stunned for 1 turn.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `grand_eagle` — Grand Eagle, 45 HP; skills: eagle_talon_rake, eagle_soar
- `wind_sprite` — Wind Sprite, 10 HP; skills: sprite_bother

## Named statuses defined here (2) — this group owns their default animations

- `rushing` — Rushing (Buff; triggers: effectGained, turnStart, skillUsed, turnEnd): On gaining it and at the start of each of the bearer's turns: 1 Swiftness and 1 Focus (until the next skill) if they have none. Ends at the end of a turn in which the bearer used no skill. _Applied by skills in: angel, cloud, mechanic, mist, ninja, nomad, storm, winter, wind._
- `leaping` — Leaping (Buff; triggers: dealtDamage, skillResolved): +5 direct damage. Ends once a skill of the bearer's has dealt direct damage and resolved, or at the end of the bearer's next turn: one chance to act with it. (Leaping also grants Invulnerable for 1 turn, applied separately.) _Applied by skills in: angel, mechanic._

## Macros defined here (3) — this group owns their default animations

- `rush_upkeep`: ops if, apply; applies swiftness, focus. _Used by: none directly._
- `leap`: ops removeEffect, apply; applies leaping, invulnerable. _Used by: angel, cloud, faerie, ghost, mist, ninja, nomad, winter, wind._
- `remove_mobility`: ops removeEffect. _Used by: nomad, wind._
