# Lightning — animation brief

Group id: `lightning`. Element(s): Lightning. Concept file: `docs/animations/concepts/lightning.yaml`.
Skill source: `packages/content/data/lightning/skills.lightning.yaml`; minions: `packages/content/data/lightning/minions.lightning.yaml`; statuses: `packages/content/data/lightning/statuses.lightning.yaml`.

## Skills (33)

### `strike.lightning` — Jolt
- Strike · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, increased by 5 for each Charge the user has.
- ops: damage

### `smash.lightning` — Static Slam
- Smash · cost SI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If the user is Charged, the target's allies take 15 damage and are Sapped.
- applies: sapped · ops: set, damage, if, apply

### `charge.lightning` — Charged Dash
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and grants the user Charge.
- applies: charged · ops: damage, apply

### `riposte.lightning` — Feedback Loop
- Riposte · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- For 1 turn, the user will counter the next Harmful skill used against them. When this triggers, it consumes the user's Charge, lowering this skill's cooldown by 1 per Charge.
- inline statuses: feedback_loop · ops: apply, set, removeEffect, adjustCooldowns
  - inline `feedback_loop` (Buff; triggers: skillTargeted/counter): Counters the next Harmful skill used on the bearer, then consumes their Charge to lower Feedback Loop's cooldown by 1 per Charge.

### `rage.lightning` — Overcharge
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Stormborn.
- applies: stormborn · ops: apply

### `shot.lightning` — Zap
- Shot · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and grants the user Charge. Costs r instead of I while the user has Charge.
- applies: charged · ops: damage, apply

### `snipe.lightning` — Particle Beam
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- The user deals 30 Piercing damage to target enemy on the following turn. This also hits any Sapped enemies. Channeled.
- inline statuses: particle_beam · ops: apply, damage
  - inline `particle_beam` (Neutral): Fires at the end of the following turn at the target and every Sapped enemy, unless interrupted.

### `trap.lightning` — Tesla Coil
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a skill, they take 15 damage and become Sapped. Invisible.
- applies: sapped · inline statuses: tesla_coil · ops: apply, damage
  - inline `tesla_coil` (Debuff, hidden; triggers: skillUsed): When the bearer uses a skill, they take 15 damage and are Sapped.

### `maneuver.lightning` — Blink
- Maneuver · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and Saps them. The user becomes Invulnerable for 1 turn.
- applies: sapped, invulnerable · ops: damage, apply

### `companion.lightning` — Storm Hawk
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Storm Hawk minion (25 HP). Stormfeather (r): 10 damage to target enemy and Saps them. Glowing Down (I): target ally gains 1 Charge.
- summons: storm_hawk · ops: summon

### `bolt.lightning` — Innervate
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Saps them.
- applies: sapped · ops: damage, apply

### `blast.lightning` — Static Burst
- Blast · cost Srr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies. Consumes the user's Charge to deal 10 additional damage per Charge.
- ops: set, removeEffect, damage

### `consume.lightning` — Siphon Charge
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and Saps them. The user gains Charge.
- applies: sapped, charged · ops: damage, apply

### `summon.lightning` — Static Elemental
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Static Elemental minion (15 HP) for 3 turns. If the user has Charge, one is consumed to give the Elemental 1 Might. Zap (r): 10 damage to target enemy, +5 if they are Sapped.
- summons: static_elemental · ops: summon

### `channel.lightning` — Lightningrod
- Channel · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Channeled
- The user gains Stormborn for as long as they keep Channeling. Channeled.
- applies: stormborn · inline statuses: lightningrod · ops: apply, if
  - inline `lightningrod` (Neutral): Channeling. The user has Stormborn until the channel is interrupted.

### `stab.lightning` — Stun Baton
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the target was at or above 80 health, the user gains Charge. If the target is then at or below 40 health, they are Sapped.
- applies: charged, sapped · ops: set, damage, if, apply, signal

### `ravage.lightning` — Malectrocute
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy, +10 if the user is Charged and +10 if the target is Sapped.
- ops: damage

### `mislead.lightning` — Hologram
- Mislead · cost Sr · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- For 1 turn, Harmful skills used by Sapped enemies are countered, as is the first one used by any other enemy, who becomes Sapped. Each counter makes the user Untargetable for 1 turn.
- applies: untargetable, sapped · inline statuses: hologram, hologram_decoy · ops: apply, removeEffect
  - inline `hologram` (Debuff; triggers: skillUsed/counter): The bearer's Harmful skills are countered; each counter makes the caster Untargetable for 1 turn.
  - inline `hologram_decoy` (Debuff; triggers: skillUsed/counter): The first Harmful skill used by any bearer is countered and Saps its user, and the caster becomes Untargetable for 1 turn. Then every Decoy ends.

### `stun.lightning` — System Shock
- Stun · cost AI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and stuns their non-Strategic skills for 1 turn, or 2 turns if they are Sapped.
- applies: stun_ns · ops: set, damage, apply

### `dance.lightning` — Three Storm Breaths
- Dance · cost SI · cooldown 5 · target **self** · tags Helpful, Strategic
- The user gains Stormborn and Conduit for 3 turns.
- applies: stormborn, conduit · ops: apply

### `heal.lightning` — Defibrillate
- Heal · cost I · cooldown 1 · target **ally** · tags Helpful, Strategic
- Heals target ally for 20 Health, +5 per Charge the user has.
- ops: heal

### `bless.lightning` — Overclock
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 2 Charge, and Conduit for 2 turns.
- applies: charged, conduit · ops: apply

### `curse.lightning` — Power Drain
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Sapped.
- applies: sapped · ops: apply

### `smite.lightning` — Apply Polarity
- Smite · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. For 1 turn, allies that damage them gain Charge.
- applies: charged · inline statuses: polarity · ops: damage, apply
  - inline `polarity` (Debuff; triggers: damaged): Units on the applier's side that damage the bearer gain 1 Charge.

### `prayer.lightning` — Signal Boost
- Prayer · cost IW · cooldown 2 · target **ally** · tags Helpful, Strategic
- Heals target ally for 25 Health and grants them Charge, then heals every Charged ally 10 Health per Charge.
- applies: charged · ops: heal, apply

### `cleave.lightning` — Arc
- Cleave · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and any Marked enemies, then Marks the target.
- applies: mark · ops: damage, apply

### `shout.lightning` — Crackle
- Shout · cost Sr · cooldown 1 · target **allEnemies** · tags Harmful, Strategic
- Saps all targetable enemies.
- applies: sapped · ops: apply

### `withstand.lightning` — Lightning Cage
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn, plus 10 per current Charge. The user gains Charge whenever this Shield takes damage.
- applies: charged · inline statuses: lightning_cage · ops: apply
  - inline `lightning_cage` (Buff; triggers: shieldDamaged): A Shield; each hit it absorbs gives the bearer 1 Charge.

### `taunt.lightning` — Aggro Signal
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 1 turn, if target enemy uses a Harmful skill, it is Reflected back to them, and they are Intimidated for 1 turn.
- applies: intimidated · inline statuses: aggro_signal · ops: apply
  - inline `aggro_signal` (Debuff; triggers: skillUsed/reflect): The bearer's next Harmful skill is reflected back at them, and they are Intimidated.

### `titan.lightning` — EXO-Armor
- Titan · cost Ir · cooldown 4 · target **self** · tags Helpful, Strategic
- The user consumes their Charge, gaining 1 Armor and 1 Swiftness per Charge consumed. Then they gain Stormborn for 3 turns.
- applies: armor, swiftness, stormborn · ops: set, removeEffect, apply

### `hawk_stormfeather` — Stormfeather (minion skill of `storm_hawk`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Saps them.
- applies: sapped · ops: damage, apply

### `hawk_glowing_down` — Glowing Down (minion skill of `storm_hawk`)
- Minion · cost I · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Charge.
- applies: charged · ops: apply

### `static_zap` — Zap (minion skill of `static_elemental`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, +5 if they are Sapped.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `storm_hawk` — Storm Hawk, 25 HP; skills: hawk_stormfeather, hawk_glowing_down
- `static_elemental` — Static Elemental, 15 HP; skills: static_zap

## Named statuses defined here (4) — this group owns their default animations

- `charged` — Charged (Buff): Charge (max 3). At 3, the owner generates 1 extra energy next turn and the Charge is spent. _Applied by skills in: aurora, battery, current, ion, magnet, plasma, reanimation, storm, thunder, vengeance, lightning._
- `sapped` — Sapped (Debuff): Max 3. At 3, the owner generates 1 less energy next turn and Sapped is removed. _Applied by skills in: aurora, battery, current, ion, magnet, plasma, reanimation, storm, thunder, vengeance, lightning._
- `stormborn` — Stormborn (Buff; triggers: damaged, dealtDamage): Gains 1 Charge whenever it deals or receives damage (Charge caps at 3). _Applied by skills in: magnet, plasma, lightning._
- `conduit` — Conduit (Buff; triggers: dealtDamage, skillTargeted): Steals all Charge from enemies it damages. Allies with Charge that use Helpful skills on it transfer their Charge to it. _Applied by skills in: lightning._
