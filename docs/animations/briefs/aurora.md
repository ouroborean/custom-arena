# Aurora — animation brief

Group id: `aurora`. Element(s): Ice + Lightning. Concept file: `docs/animations/concepts/aurora.yaml`.
Skill source: `packages/content/data/fusions/aurora/skills.aurora.yaml`; minions: `packages/content/data/fusions/aurora/minions.aurora.yaml`; statuses: `packages/content/data/fusions/aurora/statuses.aurora.yaml`.

## Skills (31)

### `strike.aurora` — Polar Jolt
- Strike · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, +5 per Charge the user has. Then 1 of that Charge is spent to give the user Shimmer until the end of their next turn.
- applies: shimmer · ops: damage, if, removeStacks, apply

### `smash.aurora` — Hoarfrost Crash
- Smash · cost SI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies. Until the end of the user's next turn, Frost debuffs on everyone it hits last and can't be removed.
- inline statuses: hoarfrost_crash · ops: damage, extendEffects, apply
  - inline `hoarfrost_crash` (Debuff): Frost debuffs on the bearer can't be removed.

### `charge.aurora` — Streak of Light
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user has Shimmer for their next skill, which deals 10 more if it hits this enemy too.
- applies: shimmer · inline statuses: streaked, streak_of_light · ops: damage, apply
  - inline `streaked` (Debuff): The Streak of Light user's next skill deals 10 more to the bearer.
  - inline `streak_of_light` (Buff): The bearer's next skill deals 10 more to the enemy hit by Streak of Light.

### `riposte.aurora` — Magnetic Veil
- Riposte · cost I · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. Its user is Sapped twice, and their Sapped can't be removed for 3 turns. Invisible.
- applies: sapped · inline statuses: magnetic_veil, magnetized · ops: apply
  - inline `magnetic_veil` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer and Saps its user.
  - inline `magnetized` (Debuff): The bearer's Sapped can't be removed.

### `rage.aurora` — Polar Storm
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, each enemy the user damages directly is Dazzled for 2 turns, and the user deals 10 more direct damage to Dazzled enemies.
- applies: dazzled · inline statuses: polar_storm · ops: apply
  - inline `polar_storm` (Buff; triggers: dealtDamage): Enemies the bearer damages directly are Dazzled for 2 turns; +10 direct damage to Dazzled enemies.

### `shot.aurora` — Glimmer
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, 20 if they were already Dazzled, and Dazzles them for 2 turns.
- applies: dazzled · ops: damage, apply

### `snipe.aurora` — Polar Lance
- Snipe · cost AIr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- Target enemy is Chilled until it lands on the following turn, and Sapped once for each energy their skills cost meanwhile. Then 35 Piercing damage. Channeled.
- applies: chilled, sapped · inline statuses: polar_lance, polar_lance_mark · ops: apply, damage
  - inline `polar_lance` (Neutral): Strikes its target at the end of the following turn.
  - inline `polar_lance_mark` (Debuff; triggers: skillUsed): Each energy the bearer's skills cost Saps them once.

### `trap.aurora` — Snare of Lights
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a skill, they and each of their allies are Dazzled for 2 turns. Invisible.
- applies: dazzled · inline statuses: snare_of_lights · ops: apply
  - inline `snare_of_lights` (Debuff, hidden; triggers: skillUsed): The first time the bearer uses a skill, their whole team is Dazzled for 2 turns.

### `maneuver.aurora` — Vanishing Light
- Maneuver · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. Their Sapped turns into as much Charge; if they're Chilled, it ends and they gain Shimmer for 2 turns.
- applies: invulnerable, charged, shimmer · ops: apply, set, removeEffect, if

### `companion.aurora` — Aurora Fox
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Aurora Fox (30 HP, Stormborn) permanently. Foxfire (r): 10 damage to target enemy, +5 per Charge the Fox has, and Dazzled for 1 turn.
- summons: aurora_fox · ops: summon

### `bolt.aurora` — Flickerbolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the user has Shimmer, it ends and this deals 15 more; if not, the user gains Shimmer for their next skill.
- applies: shimmer · ops: if, removeEffect, damage, apply

### `blast.aurora` — Borealis
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Chilled ones are Dazzled for 2 turns; the rest are Chilled for 1 turn.
- applies: dazzled, chilled · ops: damage, forEach, if, apply

### `consume.aurora` — Drink the Light
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. Their player loses 1 energy of the color they hold most, and the user's player gains it.
- ops: damage, stealEnergy

### `summon.aurora` — Stray Aurora
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Stray Aurora (30 HP) for 3 turns. At the end of each of your turns, it deals 15 damage to a random unit on whichever side has more total HP.
- summons: stray_aurora · ops: summon

### `channel.aurora` — Skyglow
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, deals 5 damage to all enemies, and every ally has Shimmer. It ends early if the user takes direct damage. Channeled.
- applies: shimmer · inline statuses: skyglow · ops: apply, damage, removeSelf
  - inline `skyglow` (Neutral; triggers: turnEnd, damaged): Each turn, 5 damage to all enemies and Shimmer for every ally; direct damage ends it.

### `stab.aurora` — Shock Icicle
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 25 if their player has 1 or no energy left. Either way, they're Dazzled for 1 turn.
- applies: dazzled · ops: damage, apply

### `ravage.aurora` — Grounding Rend
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. The user spends all their Charge, and the target is Sapped once for each Charge spent.
- applies: sapped · ops: damage, set, removeEffect, apply

### `mislead.aurora` — Ghost Lights
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and the user's player gains 1 random energy for each energy it cost (up to 2). Invisible.
- inline statuses: ghost_lights · ops: apply, repeat, gainEnergy
  - inline `ghost_lights` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and its cost (up to 2) goes to the applier's player as random energy.

### `stun.aurora` — Lightshow
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 3 turns, the next skill they use leaves them Stunned for 1 turn afterward.
- applies: stun · inline statuses: lightshow · ops: damage, apply
  - inline `lightshow` (Debuff; triggers: skillResolved): The next skill the bearer uses leaves them Stunned for 1 turn afterward.

### `dance.aurora` — Dance of Lights
- Dance · cost SA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Shimmer, and each skill they use gives them 1 Charge; every second one also gives 1 Swiftness.
- applies: shimmer, charged, swiftness · inline statuses: dance_of_lights · ops: apply, if, setFlag
  - inline `dance_of_lights` (Buff; triggers: skillUsed): Each skill the bearer uses gives 1 Charge; every second one, 1 Swiftness too.

### `heal.aurora` — Glow of the Long Night
- Heal · cost I · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15. At the start of the user's next turn, they heal 5 more for each Frost debuff on the enemy team (max 30).
- inline statuses: glow_of_the_long_night · ops: heal, apply
  - inline `glow_of_the_long_night` (Buff): Heals 5 per Frost debuff on the enemy team (max 30) when this ends.

### `bless.aurora` — Shimmering Veil
- Bless · cost I · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally gains Shimmer for 2 turns, and all of the user's Charge moves to them.
- applies: shimmer · ops: apply, moveEffects

### `curse.aurora` — Color Drain
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Dazzled for 2 turns. Each time it changes one of their player's energies, they're also Sapped.
- applies: dazzled, sapped · inline statuses: color_drain · ops: apply, if
  - inline `color_drain` (Debuff; triggers: turnStart): Each time Dazzled changes one of the bearer's player's energies, they're also Sapped.

### `smite.aurora` — Lodestar
- Smite · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Dazzles them for 1 turn. For 1 turn, each ally who damages them extends it by 1 turn.
- applies: dazzled · inline statuses: lodestar · ops: damage, apply, extendEffects
  - inline `lodestar` (Debuff; triggers: damaged): Each of the applier's allies who damages the bearer extends their Dazzle by 1 turn.

### `prayer.aurora` — Polar Dawn
- Prayer · cost WW · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and gain 10 Shield for 1 turn. Every skill on cooldown on the user's side comes 1 turn closer to ready.
- applies: shield · ops: heal, apply, adjustCooldowns

### `cleave.aurora` — Arc of Lights
- Cleave · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to a random other enemy, who is Dazzled for 1 turn.
- applies: dazzled · ops: damage, forEach, apply

### `shout.aurora` — Polar Static
- Shout · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Chilled for 2 turns. Meanwhile, each skill one of them uses gives a random ally of theirs 1 Confusion for 2 turns.
- applies: chilled, confusion · inline statuses: polar_static · ops: apply
  - inline `polar_static` (Debuff; triggers: skillUsed): Each skill the bearer uses gives a random ally of theirs 1 Confusion for 2 turns.

### `withstand.aurora` — Ice Cage
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 2 turns, and has Shimmer while any of it remains.
- applies: shimmer · inline statuses: ice_cage · ops: apply
  - inline `ice_cage` (Buff): A Shield; the bearer has Shimmer while any of it remains.

### `taunt.aurora` — Polar Beacon
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. Meanwhile, each time an enemy the user Taunted damages them, a random enemy who isn't Taunted is Taunted by the user for 1 turn.
- applies: taunt · inline statuses: polar_beacon · ops: apply, if
  - inline `polar_beacon` (Neutral; triggers: damaged): Each enemy the bearer Taunted who damages them Taunts a random un-Taunted enemy toward the bearer for 1 turn.

### `titan.aurora` — Heavenlight Armor
- Titan · cost Wr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Shimmer and Immune, and 1 Armor for each color among their player's energies.
- applies: shimmer, immune · inline statuses: heavenlight_armor · ops: apply
  - inline `heavenlight_armor` (Buff): 1 Armor per color among the bearer's player's energies.

### `aurora_fox_foxfire` — Foxfire (minion skill of `aurora_fox`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, +5 per Charge the Fox has, and Dazzles them for 1 turn.
- applies: dazzled · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `aurora_fox` — Aurora Fox, 30 HP; skills: aurora_fox_foxfire
  - passive `stormborn` (triggers: damaged, dealtDamage): Gains 1 Charge whenever it deals or receives damage (Charge caps at 3).
- `stray_aurora` — Stray Aurora, 30 HP; skills: none
  - passive `stray_aurora_drift` (triggers: turnEnd): At the end of its owner's turn, deals 15 damage to a random unit on whichever side has more total HP.

## Named statuses defined here (2) — this group owns their default animations

- `shimmer` — Shimmer (Buff): The bearer may pay colored costs with any color, as if they were random. _Applied by skills in: aurora._
- `dazzled` — Dazzled (Debuff; triggers: turnStart): At the start of each of the bearer's turns, one of their player's energies changes to a random other color. _Applied by skills in: aurora._
