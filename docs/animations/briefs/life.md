# Life — animation brief

Group id: `life`. Element(s): Earth + Earth. Concept file: `docs/animations/concepts/life.yaml`.
Skill source: `packages/content/data/fusions/life/skills.life.yaml`; minions: `packages/content/data/fusions/life/minions.life.yaml`; statuses: `packages/content/data/fusions/life/statuses.life.yaml`; macros: `packages/content/data/fusions/life/macros.life.yaml`.

## Skills (33)

### `strike.life` — Oakfist
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, plus 5 per 10 max HP the user has gained from Flourish.
- ops: damage

### `smash.life` — Groundswell
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy. Every other unit in the battle, on both sides and minions included, heals 15, which can Flourish.
- macros: flourish_it · ops: damage, forEach, heal, macro

### `charge.life` — Sapling Charge
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user creates a Seedling that takes the next hit aimed at the user.
- inline statuses: sapling_guard · summons: seedling · ops: damage, summon, apply
  - inline `sapling_guard` (Buff; triggers: damaged): The next hit on the bearer lands on one of their minions instead.

### `riposte.life` — Thornwall
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. When it does, the user creates a Seedling, and that skill's user is Taunted by the Seedling for 1 turn. Invisible.
- applies: taunt · inline statuses: thornwall · summons: seedling · ops: apply, summon
  - inline `thornwall` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; the bearer creates a Seedling, which Taunts that skill's user.

### `rage.life` — Wild Growth
- Rage · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user creates a Seedling. For 3 turns, they create another at the start of each of their turns, and they deal 5 more direct damage for each allied Seedling (up to 20 more).
- inline statuses: wild_growth_surge · summons: seedling · ops: summon, apply
  - inline `wild_growth_surge` (Buff; triggers: turnStart): The bearer creates a Seedling at the start of each of their turns; +5 direct damage per allied Seedling, up to 20.

### `shot.life` — Ripening Seed
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and gives them a Ripening Seed for 3 turns. At the end of each of the user's turns, its value rises: to 10, then to 25. Using this on them again first removes their Ripening Seed and deals them damage equal to its value, and the user heals half of what it dealt, which can Flourish. The user can have one Ripening Seed out at a time: using this removes their Ripening Seed from any other enemy, with no damage.
- inline statuses: ripening_seed · macros: flourish_it · ops: if, set, removeEffect, damage, forEach, heal, macro, apply, addStacksSelf
  - inline `ripening_seed` (Debuff; triggers: turnEnd): Its value rises at the end of each of the user's turns (10, then 25). The user's next Ripening Seed on the bearer removes it and deals its value as damage; on another enemy, it removes it with no damage.

### `snipe.life` — Heartwood Spear
- Snipe · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- At the end of each of the user's turns while it channels, Channel Growth. In 2 turns, deals 50 damage to target enemy. Channeled.
- inline statuses: heartwood_spear · macros: channel_growth · ops: apply, macro, damage
  - inline `heartwood_spear` (Neutral; triggers: turnEnd): Channel Growth at the end of each of the user's turns; strikes its target when it ends.

### `trap.life` — Strangling Roots
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, each skill target enemy uses gives them 1 Weakness for 2 turns (max 3). At 3, the user creates a Seedling. Invisible.
- applies: weakness · inline statuses: strangling_roots · summons: seedling · ops: apply, if, summon, addStacksSelf
  - inline `strangling_roots` (Debuff, hidden; triggers: skillUsed): Each skill the bearer uses gives them 1 Weakness (max 3); at 3, the applier creates a Seedling.

### `maneuver.life` — Take Root
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn and creates a Boulder. If the Boulder is still alive at the start of their next turn, it becomes a Worldsprout.
- applies: invulnerable · inline statuses: take_root · summons: boulder · ops: apply, summon, transformMinion
  - inline `take_root` (Neutral): Becomes a Worldsprout at the start of its owner's next turn.

### `companion.life` — Patient Acorn
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Acorn (5 HP, not a Seedling) permanently. At the end of each of your turns, it gains 10 max HP and heals 10, without limit. Crush (r): damage to target enemy equal to half its HP.
- summons: acorn · ops: summon

### `bolt.life` — Growing Thorn
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 2 turns, at the end of each of the user's turns, they take 10 damage and the user heals 5, which can Flourish.
- inline statuses: growing_thorn · macros: flourish_it · ops: damage, apply, forEach, heal, macro
  - inline `growing_thorn` (Debuff; triggers: turnEnd): At the end of each of the applier's turns, 10 damage to the bearer, and the applier heals 5 (Flourishing).

### `blast.life` — Verdant Wave
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. The user creates a Seedling for each enemy left below 50 HP (max 2).
- summons: seedling · ops: damage, set, repeat, summon

### `consume.life` — Harvest
- Consume · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally heals 10, plus the remaining HP of one of the user's Seedlings or Treants, which is sacrificed; this can Flourish. If the user has none, they create a Seedling.
- macros: flourish_it · summons: seedling · ops: set, forEach, kill, heal, macro, if, summon

### `summon.life` — Dryad
- Summon · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Dryad (20 HP) for 3 turns. Mend (nc): target ally heals 15, which can Flourish.
- summons: dryad · ops: summon

### `channel.life` — Tend the Grove
- Channel · cost Ir · cooldown 3 · target **self** · tags Helpful, Strategic, Channeled
- For 4 turns, at the end of each of the user's turns, every allied minion heals 15, which can Flourish; if the user has no minion, they create a Seedling. Channeled.
- inline statuses: tend_the_grove · macros: flourish_it · summons: seedling · ops: apply, if, forEach, heal, macro, summon
  - inline `tend_the_grove` (Neutral; triggers: turnEnd): At the end of each of the user's turns, allied minions heal 15 (Flourishing), or, if there are none, the user creates a Seedling.

### `stab.life` — Splinter Spike
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Sacrifices one of the user's Seedlings, if they have one, to deal 25 Piercing damage to target enemy; otherwise it deals 10 damage and the user creates a Seedling.
- summons: seedling · ops: if, kill, damage, summon

### `ravage.life` — Taproot
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. Against a Stunned target, 10 of their max HP moves to the user, counting toward the user's Flourish limit.
- ops: damage, if, addMaxHp, heal, setCounter

### `mislead.life` — Living Screen
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it lands on the user's minions instead of its targets. With no minion to take it, it's countered and the user creates a Boulder. Invisible.
- inline statuses: living_screen, living_screen_cover, living_screen_wall · summons: boulder · ops: if, apply, summon
  - inline `living_screen` (Debuff, hidden; triggers: skillUsed): The bearer's next Harmful skill hits the applier's minions instead.
  - inline `living_screen_cover` (Buff): Damage to the bearer lands on an allied minion this turn.
  - inline `living_screen_wall` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and the applier creates a Boulder.

### `stun.life` — Overgrow
- Stun · cost Ar · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. The user creates a Seedling, and the target is Stunned for 2 turns, or until that Seedling dies.
- applies: stun · summons: seedling · ops: damage, summon, apply

### `dance.life` — Evergreen
- Dance · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- For 3 turns, at the start of each of the user's turns, they heal 10, which can Flourish, and gain 1 Swiftness if they're above their starting max HP.
- applies: swiftness · inline statuses: evergreen · macros: flourish_it · ops: apply, forEach, heal, macro, if
  - inline `evergreen` (Buff; triggers: turnStart): At the start of the bearer's turn, they heal 10 (Flourishing) and gain Swiftness if they've Flourished.

### `heal.life` — Lifebloom
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20, which can Flourish. If any of it Flourishes, the user creates a Seedling.
- macros: flourish_it · summons: seedling · ops: forEach, heal, macro, if, summon

### `bless.life` — Graft
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might and 20 max HP, and they heal 20 now.
- applies: might · inline statuses: graft · ops: apply, heal
  - inline `graft` (Buff): +20 max HP.

### `curse.life` — Tangleweed
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Confusion for 2 turns, and meanwhile their skills can't target the user's minions.
- applies: confusion · inline statuses: tangleweed · ops: apply
  - inline `tangleweed` (Debuff): The bearer can't target minions.

### `smite.life` — Sunlit Glade
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Every ally heals 5, which can Flourish.
- macros: flourish_it · ops: damage, forEach, heal, macro

### `prayer.life` — Common Root
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. For 2 turns, damage dealt to any unit on the user's side is split evenly among all of them, minions included.
- inline statuses: common_root · ops: heal, apply
  - inline `common_root` (Buff): Damage to the bearer is split evenly among every unit with Common Root.

### `cleave.life` — Whirling Vines
- Cleave · cost W · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies, doubled against minions. Each enemy minion it kills becomes a Seedling for the user.
- summons: seedling · ops: set, damage, repeat, summon

### `shout.life` — Call of the Grove
- Shout · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- If there's no allied Seedling that hasn't Bloomed yet, the user creates one. Then every allied Seedling Blooms now, and every allied minion heals to full.
- macros: bloom_it · summons: seedling · ops: if, summon, forEach, macro, heal

### `withstand.life` — Barkskin
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 2 turns. When it ends, whatever is left heals the user, which can Flourish.
- inline statuses: barkskin · macros: flourish_it · ops: apply, forEach, heal, macro
  - inline `barkskin` (Buff): A Shield; when it ends, whatever is left heals the bearer (Flourishing).

### `taunt.life` — Warden Oak
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted for 2 turns by one of the user's minions, or by the user if they have none. A Seedling that survives it Blooms when it ends.
- applies: taunt · inline statuses: guardian_oak · macros: bloom_it · ops: if, forEach, set, apply, macro
  - inline `guardian_oak` (Buff): Blooms when this ends, if it survives.

### `titan.life` — Ancient Treant
- Titan · cost WW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune and 1 Armor per allied minion, and allied minions are Untargetable.
- applies: immune, armor, untargetable · ops: apply

### `treant_slam` — Treant Slam (minion skill of `treant`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy.
- ops: damage

### `acorn_crush` — Crush (minion skill of `acorn`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals damage to target enemy equal to half the Acorn's HP.
- ops: damage

### `dryad_mend` — Mend (minion skill of `dryad`)
- Minion · cost free · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally heals 15, which can Flourish.
- macros: flourish_it · ops: forEach, heal, macro

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `treant` — Treant, 40 HP; skills: treant_slam, seedling_channel_earth
- `acorn` — Acorn, 5 HP; skills: acorn_crush
  - passive `acorn_growth` (triggers: turnEnd): At the end of its owner's turn, gains 10 max HP and heals 10, without limit.
- `dryad` — Dryad, 20 HP; skills: dryad_mend

## Named statuses defined here (3) — this group owns their default animations

- `life_grove` — Grove Tender (Neutral): Seedlings this character creates Bloom into Treants if they survive until the end of its second turn. _Applied by skills in: none directly._
- `bloom_timer` — Blooming (Neutral): Blooms into a Treant when this runs out. _Applied by skills in: none directly._
- `wild_growth` — Wild Growth (Buff): Each allied Seedling that Blooms gives the bearer 1 Might for good. _Applied by skills in: none directly._

## Macros defined here (2) — this group owns their default animations

- `flourish_it`: ops set, if, addMaxHp, heal, setCounter. _Used by: life._
- `bloom_it`: ops removeEffect, if, apply, transformMinion; applies might. _Used by: life._
