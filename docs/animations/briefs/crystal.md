# Crystal — animation brief

Group id: `crystal`. Element(s): Ice + Ice. Concept file: `docs/animations/concepts/crystal.yaml`.
Skill source: `packages/content/data/fusions/crystal/skills.crystal.yaml`; minions: `packages/content/data/fusions/crystal/minions.crystal.yaml`; statuses: `packages/content/data/fusions/crystal/statuses.crystal.yaml`; macros: `packages/content/data/fusions/crystal/macros.crystal.yaml`.

## Skills (32)

### `strike.crystal` — Faceted Hammer
- Strike · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage and 1 Brittle to target enemy. Each of their other Frost debuffs ends, and they gain 1 more Brittle for each one.
- applies: brittle · macros: crystallize_it · ops: damage, apply, forEach, macro

### `smash.crystal` — Crystal Quake
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage and 1 Brittle to target enemy. Then their Brittle is removed, and each of their allies takes 10 damage per stack.
- applies: brittle · ops: damage, apply, set, removeEffect

### `charge.crystal` — Shard Rush
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage and 1 Brittle to target enemy, and the user has Diamond until they next use a skill.
- applies: brittle, diamond · ops: damage, apply

### `riposte.crystal` — Hoarfrost Guard
- Riposte · cost I · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. Its user is Frostbitten for 2 turns, and the user becomes Frostborn for as long, so that enemy can't target or damage them. Invisible.
- applies: frostbitten, frostborn · inline statuses: hoarfrost_guard · ops: apply
  - inline `hoarfrost_guard` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, Frostbiting its user.

### `rage.crystal` — Flawless
- Rage · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Diamond and 2 Might, but can't be healed.
- applies: diamond, might · inline statuses: flawless · ops: apply
  - inline `flawless` (Neutral): Can't be healed.

### `shot.crystal` — Rime Splinter
- Shot · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 1 turn, their Frost debuffs can't be removed and don't count down.
- ops: damage, extendEffects

### `snipe.crystal` — Crystal Lance
- Snipe · cost AIr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, target enemy is hit 3 times, each hit dealing 5 Piercing damage and then giving them 1 Brittle. The target of this skill is invisible. Channeled.
- applies: brittle · inline statuses: crystal_lance · ops: apply, repeat, damage
  - inline `crystal_lance` (Neutral): At the end of the following turn, unless interrupted, its target is hit 3 times for 5 Piercing damage, each hit giving them 1 Brittle.

### `trap.crystal` — Hairline Fracture
- Trap · cost II · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time target enemy uses a Harmful skill, their Brittle rises to 3. Invisible.
- applies: brittle · inline statuses: hairline_fracture · ops: apply
  - inline `hairline_fracture` (Debuff, hidden; triggers: skillUsed): The first time the bearer uses a Harmful skill, their Brittle rises to 3.

### `maneuver.crystal` — Crystal Cocoon
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains Diamond for 2 turns, and each enemy hit it caps gives the attacker 1 Brittle.
- applies: diamond, brittle · inline statuses: crystal_cocoon · ops: apply, if
  - inline `crystal_cocoon` (Buff; triggers: damaged): Each enemy hit the bearer's Diamond caps gives the attacker 1 Brittle.

### `companion.crystal` — Crystal Golem
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Crystal Golem (40 HP) permanently. Shard Burst (S): 10 damage and 1 Brittle to every enemy.
- summons: crystal_golem · ops: summon

### `bolt.crystal` — Quartz Spike
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they have a Buff, a random one ends, and they gain 2 Brittle. If they have no Buffs, they gain 1 Brittle.
- applies: brittle · ops: damage, if, removeRandom, apply

### `blast.crystal` — Hard Freeze
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. On each of them, Chilled becomes Frostbitten, and Numb becomes Chilled, each for 2 turns.
- applies: frostbitten, chilled · ops: damage, forEach, if, removeEffect, apply

### `consume.crystal` — Harvest Shards
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage and 1 Brittle to target enemy. Then all their Brittle is removed, and the user gains 10 Shield per stack.
- applies: brittle, shield · ops: damage, apply, set, removeEffect, if

### `summon.crystal` — Sentinel Shards
- Summon · cost Ir · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons 2 Sentinels (15 HP, always have Diamond) for 3 turns. Glint (r): 10 damage and 1 Brittle.
- summons: sentinel · ops: summon

### `channel.crystal` — Accretion
- Channel · cost I · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, every enemy without Brittle gains 1, and every enemy with Brittle takes 10 damage. Channeled.
- applies: brittle · inline statuses: accretion · ops: apply, forEach, if, damage
  - inline `accretion` (Neutral; triggers: turnEnd): At the end of each of the user's turns, enemies without Brittle gain 1; those with it take 10 damage.

### `stab.crystal` — Ice Pick
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. It removes one of their Frost debuffs, other than Brittle, for 10 more damage.
- ops: set, if, removeEffect, damage

### `ravage.crystal` — Breaking Point
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 40 Piercing damage to target enemy, and the user gains 1 Brittle.
- applies: brittle · ops: damage, apply

### `mislead.crystal` — Frozen Gambit
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first Harmful skill target enemy uses that costs 2 or more energy is countered, and they gain 1 Brittle for each energy it cost. Invisible.
- applies: brittle · inline statuses: frozen_gambit · ops: apply
  - inline `frozen_gambit` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Harmful skill costing 2 or more is countered, and they gain 1 Brittle per energy it cost.

### `stun.crystal` — Encrust
- Stun · cost AI · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Stunned for 2 turns and has Diamond for 2 turns.
- applies: stun, diamond · ops: damage, apply

### `dance.crystal` — Perfect Form
- Dance · cost AI · cooldown 5 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 2 Might, 2 Swiftness and 1 Focus. The first single hit of 25 or more damage on them ends all of it, and the user is Stunned for 1 turn.
- applies: stun, swiftness · inline statuses: perfect_form · ops: apply, if, removeEffect, removeSelf
  - inline `perfect_form` (Buff; triggers: damaged): 2 Might, 2 Swiftness and 1 Focus. A single hit of 25 or more ends it and Stuns the bearer for 1 turn.

### `heal.crystal` — Faceted Ward
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. For 2 turns, they can't lose more than 25 HP in a single turn.
- inline statuses: faceted_ward · ops: heal, apply
  - inline `faceted_ward` (Buff): Can't lose more than 25 HP in a single turn.

### `bless.crystal` — Diamond Skin
- Bless · cost I · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Diamond for 2 turns. When it ends, they heal half the damage it prevented, up to 30.
- inline statuses: diamond_skin · ops: apply, heal
  - inline `diamond_skin` (Buff): Diamond. When it ends, the bearer heals half the damage it prevented, up to 30.

### `curse.crystal` — Fault Lines
- Curse · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 2 turns, target enemy gains 1 Brittle each time they use a skill.
- applies: brittle · inline statuses: fault_lines · ops: apply
  - inline `fault_lines` (Debuff; triggers: skillUsed): Gains 1 Brittle each time they use a skill.

### `smite.crystal` — Cold Clarity
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, allies who damage them become Frostborn for 1 turn.
- applies: frostborn · inline statuses: cold_clarity · ops: damage, apply
  - inline `cold_clarity` (Debuff; triggers: damaged): Enemies who damage the bearer become Frostborn for 1 turn.

### `prayer.crystal` — Diamond Choir
- Prayer · cost Ir · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and gain Diamond for 1 turn.
- applies: diamond · ops: heal, apply

### `cleave.crystal` — Seeking Shards
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage and 1 Brittle to target enemy, then all their Brittle moves to a random other enemy, who takes 10 damage.
- applies: brittle · ops: damage, apply, forEach, moveEffects

### `shout.crystal` — Glass Harmonic
- Shout · cost I · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Every unit on the field, the user's side included, loses its Shield and is Shattered for 1 turn.
- applies: intimidated, shattered · ops: apply, removeShields

### `withstand.crystal` — Latticework
- Withstand · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 30 Shield for 2 turns, linked to every ally: damage any ally takes comes out of it first.
- inline statuses: latticework, latticework_link · ops: apply
  - inline `latticework` (Buff): A Shield shared with every ally.
  - inline `latticework_link` (Buff): Damage to the bearer comes out of the Latticework Shield first.

### `taunt.crystal` — Crystal Effigy
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Raises a Crystal Effigy (30 HP, always has Diamond) for 2 turns; target enemy is Taunted by it for as long. Each enemy hit on it gives the attacker 1 Brittle.
- applies: taunt · summons: crystal_effigy · ops: summon, apply

### `titan.crystal` — Diamond Colossus
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Diamond and Immune. When it ends, every enemy gains 2 Brittle.
- applies: immune, brittle · inline statuses: diamond_colossus · ops: apply
  - inline `diamond_colossus` (Buff): Diamond. When it ends, every enemy gains 2 Brittle.

### `golem_shard_slam` — Shard Burst (minion skill of `crystal_golem`)
- Minion · cost S · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage and 1 Brittle to every enemy.
- applies: brittle · ops: damage, apply

### `sentinel_glint` — Glint (minion skill of `sentinel`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage and 1 Brittle to target enemy.
- applies: brittle · ops: damage, apply

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `crystal_golem` — Crystal Golem, 40 HP; skills: golem_shard_slam
- `sentinel` — Sentinel, 15 HP; skills: sentinel_glint
  - passive `diamond`: No single hit can take more than 15 HP from the bearer (counted after Armor and Shield). Ticking damage counts as hits too.
- `crystal_effigy` — Crystal Effigy, 30 HP; skills: none
  - passive `diamond`: No single hit can take more than 15 HP from the bearer (counted after Armor and Shield). Ticking damage counts as hits too.
  - passive `effigy_shards` (triggers: damaged): Each enemy hit on it gives the attacker 1 Brittle.

## Named statuses defined here (2) — this group owns their default animations

- `brittle` — Brittle (Debuff; triggers: damaged): Max 3. Takes 5 more direct damage per stack. At 3 stacks, the next direct hit Shatters them: 20 more damage, and they're Shattered for 2 turns. Shattering removes Brittle. _Applied by skills in: crystal._
- `diamond` — Diamond (Buff): No single hit can take more than 15 HP from the bearer (counted after Armor and Shield). Ticking damage counts as hits too. _Applied by skills in: crystal._

## Macros defined here (3) — this group owns their default animations

- `shatter_bearer`: ops removeEffect, damage, apply; applies shattered. _Used by: none directly._
- `shatter_it`: ops removeEffect, damage, apply; applies shattered. _Used by: none directly._
- `crystallize_it`: ops if, removeEffect, apply; applies brittle. _Used by: crystal._
