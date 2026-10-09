# Dragon — animation brief

Group id: `dragon`. Element(s): Fire + Fire. Concept file: `docs/animations/concepts/dragon.yaml`.
Skill source: `packages/content/data/fusions/dragon/skills.dragon.yaml`; minions: `packages/content/data/fusions/dragon/minions.dragon.yaml`; statuses: `packages/content/data/fusions/dragon/statuses.dragon.yaml`; macros: `packages/content/data/fusions/dragon/macros.dragon.yaml`.

## Skills (32)

### `strike.dragon` — Wyrmclaw
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, plus 5 for every 2 Hoard the user has. Hoard isn't spent.
- ops: damage

### `smash.dragon` — Tail Sweep
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy. Each of their allies then loses a random Buff, and the user gains 1 Hoard for each Buff removed.
- applies: hoard · ops: damage, forEach, removeRandom, apply

### `charge.dragon` — Dragon's Descent
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Ignites them. The user gains 1 Focus for their next skill, and that skill gives Dragonfire to each Ignited enemy it damages.
- applies: ignite, focus, dragonfire · inline statuses: dragons_descent · ops: damage, apply, if
  - inline `dragons_descent` (Buff; triggers: dealtDamage): The bearer's next skill gives Dragonfire to each Ignited enemy it damages.

### `riposte.dragon` — Dragon's Toll
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user counters any Harmful skill used on them, and gains 1 Hoard per energy each countered skill cost. Invisible.
- applies: hoard · inline statuses: dragons_toll · ops: apply, if
  - inline `dragons_toll` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; they gain 1 Hoard per energy each one cost.

### `rage.dragon` — Wyrm's Wrath
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might, and 1 Hoard each time an enemy damages them.
- applies: might, hoard · inline statuses: wyrms_wrath · ops: apply
  - inline `wyrms_wrath` (Buff; triggers: damaged): Gains 1 Hoard each time an enemy damages the bearer.

### `shot.dragon` — Ember Spit
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- If target enemy is Ignited, deals 25 damage to them. Otherwise, deals 10 damage and gives them Dragonfire.
- macros: dragonfire_it · ops: if, damage, forEach, macro

### `snipe.dragon` — Skyfall Breath
- Snipe · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user is Untargetable by enemies until this lands. On the following turn, deals 35 damage to target enemy, plus Breath. The target of this skill is invisible. Channeled.
- inline statuses: skyfall_breath · macros: breath · ops: apply, macro, damage
  - inline `skyfall_breath` (Neutral): Untargetable by enemies. At the end of the following turn, deals 35 damage to its target, plus Breath, unless interrupted.

### `trap.dragon` — Gilded Bait
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time target enemy gains a Buff, they lose it and gain Dragonfire. Invisible.
- inline statuses: gilded_bait · macros: dragonfire_it · ops: apply, eventEffect, forEach, macro
  - inline `gilded_bait` (Debuff, hidden; triggers: effectGained): The first Buff the bearer gains is lost, and they gain Dragonfire.

### `maneuver.dragon` — Burning Wake
- Maneuver · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. While it lasts, each Ignite they applied also deals its damage at the start of its bearer's turn.
- applies: invulnerable, burning_wake · ops: apply

### `companion.dragon` — Drake
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Drake (40 HP) permanently. At the end of each of your turns, if any enemy is Ignited, it gives the user 1 Hoard. Drake Claw (r): 15 damage and Scorched for 1 turn.
- summons: drake · ops: summon

### `bolt.dragon` — Wyrmbolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they're Ignited, their Ignite deals its damage twice right now.
- macros: burn_aftermath · ops: damage, if, repeat, macro

### `blast.dragon` — Great Breath
- Blast · cost SI · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, plus Breath. Ignited enemies take 10 more.
- macros: breath · ops: macro, damage

### `consume.dragon` — Devour Embers
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Every Ignite on the enemy side ends, and the user heals 10 and gains 1 Hoard for each. Then target enemy takes 5 damage and is Ignited.
- applies: hoard, ignite · ops: forEach, removeEffect, heal, apply, damage

### `summon.dragon` — Dragon Egg
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Dragon Egg (30 HP) for 3 turns. It does nothing, but if it's still alive when it expires, it hatches into a permanent Wyrmling (30 HP). Wyrmling Bite (r): 15 damage and Ignite.
- summons: dragon_egg · ops: summon

### `channel.dragon` — Wyrmfire Torrent
- Channel · cost SI · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, deals 10 damage to all enemies each turn, or 15 to those with Dragonfire; then a random enemy without Dragonfire gains it. Channeled.
- inline statuses: wyrmfire_torrent · macros: dragonfire_it · ops: apply, damage, forEach, macro
  - inline `wyrmfire_torrent` (Neutral; triggers: turnEnd): At the end of each of the user's turns, deals 10 damage to all enemies (15 to those with Dragonfire), then a random enemy without Dragonfire gains it.

### `stab.dragon` — Fang
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and gives them Fang for 2 turns. If they already have the user's Fang, it's removed instead: they take 25 damage, and the user gains 1 Hoard.
- applies: hoard · inline statuses: fang · ops: if, removeEffect, signal, damage, apply
  - inline `fang` (Debuff): If the applier uses Fang on the bearer again, this is removed, the bearer takes 25 damage, and the applier gains 1 Hoard.

### `ravage.dragon` — Molten Maw
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, 15 more if they're Scorched. For 2 turns, each time their Ignite deals damage, they're Scorched for 1 turn.
- applies: scorched · inline statuses: molten_maw · ops: damage, apply, if
  - inline `molten_maw` (Debuff; triggers: damaged): Each time the bearer's Ignite deals damage to them, they're Scorched for 1 turn.

### `mislead.dragon` — Covetous Eye
- Mislead · cost A · cooldown 2 · target **allEnemies** · tags Harmful, Strategic, Invisible
- For 1 turn, the first enemy skill that costs 3 or more energy is countered. Next turn, its user generates 1 less energy and the user generates 1 more. Invisible.
- inline statuses: covetous_eye, covetous_eye_loss, covetous_eye_gain · ops: apply
  - inline `covetous_eye` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first skill costing 3 or more energy is countered. Next turn, they generate 1 less energy and the applier 1 more.
  - inline `covetous_eye_loss` (Debuff): Generates 1 less energy next turn.
  - inline `covetous_eye_gain` (Buff): Generates 1 more energy next turn.

### `stun.dragon` — Dragonfear
- Stun · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy falls Asleep for 2 turns. If damage wakes them, they Explode.
- inline statuses: dragonfear · macros: explode · ops: apply, removeSelf, macro
  - inline `dragonfear` (Debuff; triggers: damaged): Counts as Asleep. If damage wakes the bearer, they Explode.

### `dance.dragon` — Warming Wings
- Dance · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus, and each time an Ignite they applied deals damage, the ally with the least HP heals as much.
- applies: swiftness, focus, warming_wings · ops: apply

### `heal.dragon` — Hearthfire
- Heal · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally heals 15, plus 10 for each Hoard the user spends, up to 3.
- ops: heal, repeat, removeStacks

### `bless.dragon` — Dragonblood
- Bless · cost S · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 2 turns, target ally's damaging skills also Ignite their targets, or give Dragonfire to targets already Ignited.
- applies: dragonfire, ignite · inline statuses: dragonblood · ops: apply, if
  - inline `dragonblood` (Buff; triggers: dealtDamage): The bearer's direct damage Ignites its targets, or gives Dragonfire to those already Ignited.

### `curse.dragon` — Slag
- Curse · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy loses all Armor and Shield, gains 1 Vulnerable for 2 turns, and gains Dragonfire.
- applies: vulnerable · macros: dragonfire_it · ops: removeEffect, apply, forEach, macro

### `smite.dragon` — Pyre Brand
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, and they're Scorched for 1 turn. When that Scorch ends, they Explode if they're still Ignited.
- applies: scorched · inline statuses: pyre_brand · macros: explode · ops: damage, apply, if, macro
  - inline `pyre_brand` (Debuff): When this ends, the bearer Explodes if they're still Ignited.

### `prayer.dragon` — Dragon's Slumber
- Prayer · cost SW · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield. Then the user falls Asleep for up to 3 turns, and all allies heal 20 at the end of each of the user's turns while they're Asleep.
- applies: shield, sleep · inline statuses: dragons_slumber · ops: heal, apply, if, removeSelf
  - inline `dragons_slumber` (Buff; triggers: turnEnd): While the bearer sleeps, all their allies heal 20 at the end of their turn.

### `cleave.dragon` — Wildfire Wing
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and gives them Dragonfire. A random other enemy is Ignited, or gains Dragonfire if they already were. At the end of the user's next turn, if the target still has Dragonfire, this happens once more to a random other enemy.
- inline statuses: wildfire_wing · macros: dragonfire_it, ignite_or_dragonfire_it · ops: damage, forEach, macro, apply, if, addStacksSelf
  - inline `wildfire_wing` (Debuff; triggers: turnEnd): At the end of the applier's next turn, if the bearer still has Dragonfire, a random other enemy is Ignited, or gains Dragonfire if they already were.

### `shout.dragon` — Terrible Roar
- Shout · cost r · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. For as long, each time one of them is healed, they're Ignited.
- applies: intimidated, ignite · inline statuses: terrible_roar · ops: apply
  - inline `terrible_roar` (Debuff; triggers: healed): Each time the bearer is healed, they're Ignited.

### `withstand.dragon` — Furnace Hide
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- A random enemy gains Dragonfire. For 2 turns, it doesn't deal damage, and at the end of each of the user's turns, if that enemy still has it, the user gains 15 Shield for 1 turn. When the 2 turns end, that enemy loses their Dragonfire and Ignite.
- applies: banked_fire · macros: dragonfire_it · ops: forEach, macro, apply

### `taunt.dragon` — Wyrm's Domain
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. Meanwhile, any other enemy who uses a Harmful skill on the user or their allies takes 10 damage.
- applies: taunt · inline statuses: wyrms_domain · ops: apply, if, damage
  - inline `wyrms_domain` (Buff; triggers: skillTargeted): Any enemy not Taunted by the applier who uses a Harmful skill on the bearer takes 10 damage.

### `titan.dragon` — Elder Wyrm
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 3 Hoard. For 3 turns, they gain Immune, and every Hoard gives 1 Armor instead of every 2.
- applies: hoard, immune, elder_wyrm · ops: apply

### `drake_claw` — Drake Claw (minion skill of `drake`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Scorches them for 1 turn.
- applies: scorched · ops: damage, apply

### `wyrmling_bite` — Wyrmling Bite (minion skill of `wyrmling`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Ignites them.
- applies: ignite · ops: damage, apply

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `drake` — Drake, 40 HP; skills: drake_claw
  - passive `drake_hoard` (triggers: turnEnd): At the end of its owner's turn, if any enemy is Ignited, its owner gains 1 Hoard.
- `dragon_egg` — Dragon Egg, 30 HP; skills: none
- `wyrmling` — Wyrmling, 30 HP; skills: wyrmling_bite

## Named statuses defined here (7) — this group owns their default animations

- `dragonfire` — Dragonfire (Debuff; triggers: turnEnd, turnStart): Counts as Ignite, but deals 10 Affliction damage at the end of its applier's turn instead of 5. Applied to an Ignited unit, it upgrades the Ignite. _Applied by skills in: dragon._
- `wyrm_heart` — Wyrm's Heart (Neutral): Each time an Ignite or Dragonfire this character applied deals damage, they gain 1 Hoard. _Applied by skills in: none directly._
- `hoard` — Hoard (Buff): Max 6. Every 2 Hoard gives 1 Armor (every 1 during Elder Wyrm). Breath skills spend all of it for 5 more damage per Hoard to each target. _Applied by skills in: dragon._
- `burning_wake` — Burning Wake (Buff): Each Ignite the bearer applied also burns at the start of its bearer's turn. _Applied by skills in: dragon._
- `warming_wings` — Warming Wings (Buff): Each time an Ignite the bearer applied deals damage, their ally with the least HP heals as much. _Applied by skills in: dragon._
- `elder_wyrm` — Elder Wyrm (Buff): Every Hoard gives 1 Armor instead of every 2. _Applied by skills in: dragon._
- `banked_fire` — Banked Fire (Neutral; triggers: turnEnd): The bearer's Dragonfire doesn't burn. At the end of the applier's turn, if the bearer still has Dragonfire, the applier gains 15 Shield for 1 turn. When this ends, the bearer loses their Dragonfire and Ignite. _Applied by skills in: dragon._

## Macros defined here (3) — this group owns their default animations

- `dragonfire_it`: ops apply; applies ignite, dragonfire. _Used by: dragon._
- `ignite_or_dragonfire_it`: ops if, apply; applies dragonfire, ignite. _Used by: dragon._
- `breath`: ops set, removeEffect. _Used by: dragon._
