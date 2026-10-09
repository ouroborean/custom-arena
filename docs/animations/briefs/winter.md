# Winter — animation brief

Group id: `winter`. Element(s): Ice + Wind. Concept file: `docs/animations/concepts/winter.yaml`.
Skill source: `packages/content/data/fusions/winter/skills.winter.yaml`; minions: `packages/content/data/fusions/winter/minions.winter.yaml`; statuses: `packages/content/data/fusions/winter/statuses.winter.yaml`.

## Skills (32)

### `strike.winter` — Bitter Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they have Swiftness, Rushing or Leaping, they're Snowbound for 2 turns.
- applies: snowbound · ops: damage, if, apply

### `smash.winter` — Snowslide
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- The user Leaps. At the start of their next turn, if they're still Leaping, they stop Leaping and deal 25 damage to target enemy and 15 to their allies.
- inline statuses: snowslide · macros: leap · ops: forEach, macro, apply, if, damage, removeEffect
  - inline `snowslide` (Neutral): At the start of the bearer's next turn, if they're still Leaping, they stop Leaping and deal 25 damage to the target and 15 to their allies.

### `charge.winter` — Ice Skate
- Charge · cost r · cooldown 1 · target **self** · tags Helpful, Strategic
- The user gains 2 Swiftness for 2 turns. Their next Harmful skill spends their Swiftness for 5 more damage per stack, and every enemy it damages is Snowbound for 1 turn.
- applies: swiftness, snowbound · inline statuses: ice_skate · ops: apply, removeEffect
  - inline `ice_skate` (Buff; triggers: dealtDamage, skillResolved): The bearer's next Harmful skill spends their Swiftness for 5 more damage per stack and Snowbinds every enemy it damages for 1 turn.

### `riposte.winter` — Shatterguard
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. Every Frost debuff on its user ends, and they take 15 Piercing damage for each. Invisible.
- inline statuses: shatterguard · ops: apply, set, removeEffect, damage
  - inline `shatterguard` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; every Frost debuff on its user ends, dealing them 15 Piercing damage for each.

### `rage.winter` — Heart of Winter
- Rage · cost I · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Immune, and any enemy who uses a mobility skill is Snowbound for 2 turns.
- applies: might, immune, snowbound · inline statuses: heart_of_winter · ops: apply
  - inline `heart_of_winter` (Debuff; triggers: skillUsed): Using a mobility skill Snowbinds the bearer for 2 turns.

### `shot.winter` — Snowball
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, +5 for each turn in a row the user has used Snowball. From the third in a row, they're also Snowbound for 1 turn.
- applies: snowbound · ops: setCounter, damage, if, apply

### `snipe.winter` — Whiteout
- Snipe · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- On the following turn, deals 60 Piercing damage, split evenly among the enemy characters who aren't Immobile then (or among all of them, if every one is). Channeled.
- inline statuses: whiteout · ops: apply, set, if, damage
  - inline `whiteout` (Neutral): At the end of the following turn, 60 Piercing split among the enemy characters who aren't Immobile (or all of them), unless interrupted.

### `trap.winter` — Snare of Frost
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, if target enemy uses a mobility skill, it's countered, and they take 15 Piercing damage and are Snowbound for 2 turns. Invisible.
- applies: snowbound · inline statuses: snare_of_frost · ops: apply, damage
  - inline `snare_of_frost` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next mobility skill is countered, and they take 15 Piercing damage and are Snowbound for 2 turns.

### `maneuver.winter` — Powder Leap
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- For 2 turns, the first time an enemy uses a Harmful skill on the user, they Leap before it lands, and that enemy is Snowbound for 1 turn.
- applies: snowbound · inline statuses: powder_leap · macros: leap · ops: apply, if, forEach, macro, removeEffect, removeSelf
  - inline `powder_leap` (Neutral; triggers: skillUsed): The bearer's first Harmful skill on the applier makes them Leap before it lands, and Snowbinds the bearer for 1 turn.

### `companion.winter` — Great Yeti
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Great Yeti (80 HP) permanently. Yeti Maul (nc): 30 damage to target enemy. At the start of each of the user's turns, their player pays 1 random energy, or it leaves.
- summons: great_yeti · ops: summon

### `bolt.winter` — Frostwind Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. A random other enemy takes 10 damage and is Snowbound for 1 turn.
- applies: snowbound · ops: damage, forEach, apply

### `blast.winter` — Polar Gale
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. If the user is Rushing or Leaping, they stop, and every enemy is Snowbound for 1 turn, or 2 if they were both.
- applies: snowbound · ops: damage, set, removeEffect, if, apply

### `consume.winter` — Steal Warmth
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, and every Frost debuff on the user (Snowbound included) moves to them. The user heals 10, plus 10 for each one moved.
- ops: damage, set, moveEffects, heal

### `summon.winter` — Snow Sprites
- Summon · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- Summons a Snow Sprite (20 HP) for 3 turns. Flurry (nc): 5 Piercing damage to all enemies. When the Sprite is destroyed or its time runs out, every enemy is Snowbound for 1 turn.
- summons: snow_sprite · ops: summon

### `channel.winter` — Long Winter
- Channel · cost II · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, deals 5 damage to all enemies, then 10, then 15. The third time also leaves every enemy Snowbound for 2 turns. Channeled.
- applies: snowbound · inline statuses: long_winter · ops: apply, damage, if, addStacksSelf
  - inline `long_winter` (Neutral; triggers: turnEnd): Each turn, 5 more damage to all enemies than the last; the third time also Snowbinds them for 2 turns.

### `stab.winter` — Icicle Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're Immobile. If the user is Rushing, the target is also Snowbound for 1 turn.
- applies: snowbound · ops: damage, if, apply

### `ravage.winter` — Frostbite Lunge
- Ravage · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. The user is Frostbitten for 1 turn and gains Frostborn for 2.
- applies: frostbitten, frostborn · ops: damage, apply

### `mislead.winter` — Snatching Gale
- Mislead · cost Ir · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and stored until the end of the user's next turn. The next Harmful skill the user uses meanwhile also uses the stored skill, as the user's own, on that skill's first target. Invisible.
- inline statuses: snatching_gale, snatched_skill · ops: apply, castSkill
  - inline `snatching_gale` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered and stored for the applier.
  - inline `snatched_skill` (Buff; triggers: skillResolved): The bearer's next Harmful skill also uses the stored skill, as their own, on its first target.

### `stun.winter` — Squall
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Snowbound for 2 turns. If they're still Snowbound at the end of their next turn, they're Stunned for 1 turn.
- applies: snowbound, stun · inline statuses: squall · ops: damage, apply, if
  - inline `squall` (Debuff): If the bearer is still Snowbound at the end of their next turn, they're Stunned for 1 turn.

### `dance.winter` — Snow Dance
- Dance · cost AA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and 2 Swiftness, and begins Rushing. Whenever their Swiftness stops a Stun, the Stun's user is Snowbound for 2 turns.
- applies: might, swiftness, rushing, snowbound · inline statuses: snow_dance · ops: apply
  - inline `snow_dance` (Buff; triggers: incomingNegated): When the bearer's Swiftness stops a Stun, its user is Snowbound for 2 turns.

### `heal.winter` — Thawing Wind
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. For 2 turns, whenever they damage an enemy with a Frost debuff, they begin Rushing.
- applies: rushing · inline statuses: thawing_wind · ops: heal, apply, if
  - inline `thawing_wind` (Buff; triggers: dealtDamage): Damaging an enemy with a Frost debuff makes the bearer begin Rushing.

### `bless.winter` — Rime Mantle
- Bless · cost I · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Frostborn for 2 turns. Meanwhile, each enemy who damages them is Chilled for 1 turn.
- applies: frostborn, chilled · inline statuses: rime_mantle · ops: apply
  - inline `rime_mantle` (Buff; triggers: damaged): Each enemy who damages the bearer is Chilled for 1 turn.

### `curse.winter` — Snowbind
- Curse · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Snowbound for 1 turn. Each skill they use while it lasts makes it last 1 turn longer (up to 3 times).
- applies: snowbound · inline statuses: snowbind · ops: apply, if, extendEffects, addStacksSelf
  - inline `snowbind` (Debuff; triggers: skillUsed): Each skill the bearer uses while Snowbound adds 1 turn to it (stacks are the turns left to add).

### `smite.winter` — Frostfeather
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, the second time the user's side damages them again, they take 10 Piercing damage and are Frostbitten for 1 turn.
- applies: frostbitten · inline statuses: frostfeather · ops: damage, apply, if, removeSelf, setFlag
  - inline `frostfeather` (Debuff; triggers: damaged): The second direct hit from the applier's side deals the bearer 10 Piercing damage, and they're Frostbitten for 1 turn.

### `prayer.winter` — Snowed In
- Prayer · cost Wr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 30 and gain 15 Shield for 1 turn. Then every unit on both sides, the user included, is Snowbound for 1 turn.
- applies: shield, snowbound · ops: heal, apply

### `cleave.winter` — Winter's Descent
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. Each other enemy who's Immobile takes 10; each other one takes 5 and is Snowbound for 1 turn.
- applies: snowbound · ops: damage, forEach, if, apply

### `shout.winter` — Howling Winds
- Shout · cost I · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- Enemies with a mobility skill or buff are Snowbound for 2 turns; Immobile enemies are Intimidated for 2 turns instead.
- applies: intimidated, snowbound · ops: forEach, if, apply

### `withstand.winter` — Deepening Drift
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 10 Shield for 3 turns, and 10 more at the start of each of their turns meanwhile. It's all removed when they use a damaging skill.
- inline statuses: deepening_drift · ops: apply, boostShields, removeSelf
  - inline `deepening_drift` (Buff; triggers: turnStart, dealtDamage): A Shield that grows 10 each turn and is removed when the bearer deals direct damage.

### `taunt.winter` — Call of the Cold
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Snowbound for 1 turn, and Taunted by the user for as long as they stay Snowbound (up to 3 turns).
- applies: snowbound · inline statuses: call_of_the_cold · ops: apply
  - inline `call_of_the_cold` (Debuff): Taunted by the applier while Snowbound.

### `titan.winter` — Dead of Winter
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Immune, and no unit in the battle can be healed, the user included.
- applies: armor, immune · inline statuses: dead_of_winter · ops: apply
  - inline `dead_of_winter` (Neutral): Can't be healed.

### `great_yeti_maul` — Yeti Maul (minion skill of `great_yeti`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy.
- ops: damage

### `snow_sprite_flurry` — Flurry (minion skill of `snow_sprite`)
- Minion · cost free · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to all enemies.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `great_yeti` — Great Yeti, 80 HP; skills: great_yeti_maul
  - passive `great_yeti_hunger` (triggers: turnStart): At the start of its owner's turns, their player pays 1 random energy, or it leaves.
- `snow_sprite` — Snow Sprite, 20 HP; skills: snow_sprite_flurry

## Named statuses defined here (1) — this group owns their default animations

- `snowbound` — Snowbound (Debuff; triggers: effectGained): Counts as a Frost debuff, and the bearer counts as Immobile. They lose their mobility buffs (Swiftness, Rushing, Leaping), can't gain new ones, and their mobility skills cost 1 more. _Applied by skills in: lich, myth, winter._
