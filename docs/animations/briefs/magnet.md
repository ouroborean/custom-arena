# Magnet — animation brief

Group id: `magnet`. Element(s): Lightning + Earth. Concept file: `docs/animations/concepts/magnet.yaml`.
Skill source: `packages/content/data/fusions/magnet/skills.magnet.yaml`; minions: `packages/content/data/fusions/magnet/minions.magnet.yaml`; statuses: `packages/content/data/fusions/magnet/statuses.magnet.yaml`.

## Skills (33)

### `strike.magnet` — Lodestone Fist
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they have more Might than the user, the user Attracts Might from them until the two are even.
- applies: might · ops: damage, repeat, removeStacks, apply

### `smash.magnet` — Iron Quake
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies; the user Repels one of their own Debuffs onto each enemy hit.
- ops: damage, forEach, stealRandom

### `charge.magnet` — Reel In
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. Until the end of the user's next turn, any Armor, Shield, Might or Charge they gain is Attracted to the user.
- inline statuses: reel_in · ops: damage, apply, moveEffects
  - inline `reel_in` (Debuff; triggers: effectGained): Armor, Shield, Might and Charge the bearer gains go to the applier.

### `riposte.magnet` — Repulsor Ward
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the first Harmful skill used on the user is Reflected, and the user Repels one Debuff onto its user. Invisible.
- inline statuses: repulsor_ward · ops: apply, stealRandom
  - inline `repulsor_ward` (Buff, hidden; triggers: skillTargeted/reflect): Reflects the first Harmful skill used on the bearer and Repels a Debuff onto its user.

### `rage.magnet` — Repelling Fury
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might. At the start of each of their turns, they Repel all their Debuffs onto the enemy who last damaged them.
- applies: might · inline statuses: repelling_fury · ops: apply, moveEffects
  - inline `repelling_fury` (Buff; triggers: turnStart): At the start of each of the bearer's turns, they Repel all their Debuffs onto the enemy who last damaged them.

### `shot.magnet` — Magnetic Launch
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If there's an allied Boulder, it sheds 15 HP to add 15 damage.
- ops: if, damage

### `snipe.magnet` — Mass Driver
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user creates a Boulder. On the following turn, a random allied Boulder is destroyed to deal target enemy 20 damage plus its remaining HP. The target of this skill is invisible. Channeled.
- inline statuses: mass_driver · summons: boulder · ops: summon, apply, forEach, set, damage, kill
  - inline `mass_driver` (Neutral): At the end of the following turn, a random allied Boulder is destroyed to deal the target 20 damage plus its HP.

### `trap.magnet` — Polarized Trap
- Trap · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a Harmful skill, they take 15 damage and the user Attracts all their Armor and Shield. Invisible.
- inline statuses: polarized_trap · ops: apply, damage, moveEffects
  - inline `polarized_trap` (Debuff, hidden; triggers: skillUsed): The bearer's first Harmful skill deals them 15 damage, and the applier Attracts their Armor and Shield.

### `maneuver.magnet` — Maglev
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn and Repels all their Debuffs onto a random enemy.
- applies: invulnerable · ops: apply, moveEffects

### `companion.magnet` — Lodestone Golem
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Lodestone Golem (50 HP) permanently. Magnetize (r): Attracts 1 Armor or 10 Shield from target enemy to the Golem. Iron Fist (nc): 10 damage.
- summons: lodestone_golem · ops: summon

### `bolt.magnet` — Polarity Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. The user first Repels up to 2 of their own Debuffs onto them, and it deals 10 more per Debuff moved.
- ops: set, repeat, stealRandom, damage

### `blast.magnet` — Magnetic Storm
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. The user spends all their Charge, and each enemy is Sapped once per Charge spent.
- applies: sapped · ops: damage, set, removeEffect, apply

### `consume.magnet` — Ferrous Harvest
- Consume · cost r · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to every enemy and enemy minion that has Armor or Shield; the user heals 10 for each one hit.
- ops: set, damage, heal

### `summon.magnet` — Clinging Filings
- Summon · cost W · cooldown 1 · target **enemy** · tags Harmful, Strategic
- Summons Iron Filings (20 HP) for 3 turns on target enemy. Grind (r): 10 Piercing damage to that enemy.
- inline statuses: clinging_filings · summons: iron_filings · ops: summon, apply
  - inline `clinging_filings` (Debuff): Grind from the applier's Iron Filings hits the bearer.

### `channel.magnet` — Electromagnet
- Channel · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, 10 damage to all enemies, Attracting 10 Shield from each. It ends early if an enemy damages the user. Channeled.
- applies: shield · inline statuses: electromagnet · ops: apply, damage, forEach, boostShields, removeSelf
  - inline `electromagnet` (Neutral; triggers: turnEnd, damaged): Each turn, 10 damage to all enemies, and the bearer Attracts 10 of each one's Shield.

### `stab.magnet` — Grounding Pin
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP; then all their Sapped is spent for 10 more damage per stack.
- ops: set, damage, removeEffect

### `ravage.magnet` — Rail Drill
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, after the user Attracts all their Armor; 10 more per Armor taken.
- ops: set, moveEffects, damage

### `mislead.magnet` — Pole Reversal
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and the user takes their Armor, Might, Charge and Shield. Invisible.
- inline statuses: pole_reversal · ops: apply, moveEffects
  - inline `pole_reversal` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and the applier takes their Armor, Might, Charge and Shield.

### `stun.magnet` — Clamp
- Stun · cost Ar · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn, and the user Attracts their Armor and Shield.
- applies: stun · ops: apply, moveEffects

### `dance.magnet` — Static Quarry
- Dance · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 1 Swiftness and Stormborn; each time they reach 3 Charge, they also create a Boulder.
- applies: swiftness, stormborn · inline statuses: static_quarry · summons: boulder · ops: apply, if, summon
  - inline `static_quarry` (Buff; triggers: effectGained): Reaching 3 Charge also creates a Boulder.

### `heal.magnet` — Draw Out
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15 and Repels one Debuff onto a random enemy.
- ops: heal, stealRandom

### `bless.magnet` — Polarized Plating
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Armor, and the first Debuff put on them each turn is Repelled onto a random enemy.
- applies: armor · inline statuses: polarized_plating · ops: apply, if, setCounter, copyEventEffect, eventEffect
  - inline `polarized_plating` (Buff; triggers: effectGained): The first Debuff on the bearer each turn is Repelled onto a random enemy.

### `curse.magnet` — Offload
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Each ally Repels one Debuff onto target enemy.
- ops: forEach, stealRandom

### `smite.magnet` — True North
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Vulnerable until the user's next turn.
- applies: vulnerable · ops: damage, apply

### `prayer.magnet` — Shared Field
- Prayer · cost Srr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- The user Attracts every enemy's Shield and splits it evenly among their allies; then all allies heal 20.
- applies: shield · ops: set, forEach, removeEffect, if, apply, heal

### `cleave.magnet` — Grounding Whirl
- Cleave · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy. Until the user's next turn, they gain 1 Charge each time an ally takes damage.
- applies: charged · inline statuses: grounding_whirl · ops: damage, apply
  - inline `grounding_whirl` (Buff; triggers: damaged): Damage to the bearer gives the applier 1 Charge.

### `shout.magnet` — Lodestone Hum
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns, and Sapped once for each allied Boulder.
- applies: intimidated, sapped · ops: apply

### `withstand.magnet` — Rebound Plate
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn. When it ends, they Repel one Debuff onto each enemy who damaged them meanwhile.
- applies: rebound_mark · inline statuses: rebound_plate · ops: apply, forEach, stealRandom
  - inline `rebound_plate` (Buff; triggers: damaged): A Shield; when it ends, a Debuff is Repelled onto each enemy who damaged the bearer.

### `taunt.magnet` — Opposite Poles
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns, and the user's Harmful skills can target only them for as long.
- applies: taunt, opposite_pole · inline statuses: opposite_poles · ops: apply
  - inline `opposite_poles` (Neutral): Among enemies, the bearer's skills can target only the one with Opposite Pole.

### `titan.magnet` — Iron Colossus
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user creates a Boulder, then destroys every allied Boulder and gains 1 Armor per 15 HP they had in total, and is Immune, for 3 turns. When it ends, the user creates one Boulder with 10 HP per Armor gained.
- applies: armor · inline statuses: iron_colossus · summons: boulder · ops: summon, set, kill, setCounter, apply, if, addMaxHp, heal
  - inline `iron_colossus` (Buff): Immune; when it ends, the bearer creates a Boulder with 10 HP per Armor gained.

### `lodestone_golem_magnetize` — Magnetize (minion skill of `lodestone_golem`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Attracts 1 Armor or 10 Shield from target enemy to the Golem.
- applies: armor, shield · ops: if, removeStacks, apply, boostShields

### `lodestone_golem_iron_fist` — Iron Fist (minion skill of `lodestone_golem`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

### `iron_filings_grind` — Grind (minion skill of `iron_filings`)
- Minion · cost r · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to the enemy the Filings were summoned on.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `lodestone_golem` — Lodestone Golem, 50 HP; skills: lodestone_golem_magnetize, lodestone_golem_iron_fist
- `iron_filings` — Iron Filings, 20 HP; skills: iron_filings_grind

## Named statuses defined here (2) — this group owns their default animations

- `rebound_mark` — Rebound (Debuff): Damaged the bearer of a Rebound Plate; when it ends, a Debuff will be Repelled onto them. _Applied by skills in: magnet._
- `opposite_pole` — Opposite Pole (Debuff): The only enemy the Opposite Poles user can target. _Applied by skills in: magnet._
