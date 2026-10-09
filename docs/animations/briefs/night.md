# Night — animation brief

Group id: `night`. Element(s): Ice + Shadow. Concept file: `docs/animations/concepts/night.yaml`.
Skill source: `packages/content/data/fusions/night/skills.night.yaml`; minions: `packages/content/data/fusions/night/minions.night.yaml`; statuses: `packages/content/data/fusions/night/statuses.night.yaml`; macros: `packages/content/data/fusions/night/macros.night.yaml`.

## Skills (31)

### `strike.night` — Gloaming Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, and their Dusk deepens by 1. 15 more against Frozen Sleep.
- macros: deepen_dusk · ops: damage, forEach, macro

### `smash.night` — Moonfall
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who gains Dusk 3, or has their Dusk deepened by 1. When Midnight strikes them, they take 20 damage and each of their allies takes 10.
- inline statuses: moonfall · macros: dusk · ops: damage, apply, set, forEach, macro
  - inline `moonfall` (Debuff, hidden; triggers: effectGained): When Midnight strikes the bearer, they take 20 damage and each of their allies takes 10.

### `charge.night` — Silent Descent
- Charge · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 15 damage to target enemy, who gains Dusk 3; if the user is Stealthed, they also gain 1 Focus. Stealthy.
- applies: focus · macros: dusk · ops: damage, set, forEach, macro, if, apply

### `riposte.night` — Snowdrift Shelter
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. When it does, the user's ally with the least HP becomes Dormant for 1 turn. Invisible.
- applies: dormant · inline statuses: snowdrift_shelter · ops: apply
  - inline `snowdrift_shelter` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; the weakest ally becomes Dormant.

### `rage.night` — Polar Night
- Rage · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Immune, and using skills doesn't end their Stealth.
- applies: might, immune · inline statuses: polar_night · ops: apply
  - inline `polar_night` (Buff): The bearer's skills count as Stealthy.

### `shot.night` — Evening Star
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains Dusk 4, or has their Dusk deepened by 1.
- macros: dusk · ops: damage, set, forEach, macro

### `snipe.night` — Last Light
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy, or 70 Piercing if they're in Frozen Sleep. The target of this skill is invisible. Channeled.
- inline statuses: last_light · ops: apply, forEach, if, damage
  - inline `last_light` (Neutral): Strikes its target at the end of the following turn; harder against Frozen Sleep.

### `trap.night` — Breaking Ice
- Trap · cost AI · cooldown 3 · target **ally** · tags Helpful, Strategic, Invisible
- For 3 turns, the first enemy to use a Harmful skill on target ally takes 20 Piercing damage and is Stunned for 1 turn. Invisible.
- applies: stun · inline statuses: breaking_ice · ops: apply, damage
  - inline `breaking_ice` (Buff, hidden; triggers: skillTargeted): The first enemy to use a Harmful skill on the bearer takes 20 Piercing damage and is Stunned for 1 turn.

### `maneuver.night` — Hibernate
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Dormant for 2 turns.
- applies: dormant · ops: apply

### `companion.night` — Snow Owl
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Snow Owl (25 HP) permanently. At the end of each of your turns, a random enemy without Dusk gains Dusk 4. Silent Talons (A): 15 damage, 30 against Frozen Sleep.
- summons: snow_owl · ops: summon

### `bolt.night` — Rime Lance
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains Dusk 3, or has their Dusk deepened by 1. Until the user's next turn, the next hit they take deepens it by 1 more.
- inline statuses: rime_lance · macros: dusk, deepen_dusk · ops: damage, set, forEach, macro, apply
  - inline `rime_lance` (Debuff, hidden; triggers: damaged): The next hit the bearer takes deepens their Dusk by 1.

### `blast.night` — Eventide
- Blast · cost AIr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, and each gains Dusk 3 or has it deepened.
- macros: dusk · ops: damage, set, forEach, macro

### `consume.night` — Stolen Hours
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. Then every Debuff on the user's side loses 1 turn, and every Debuff on target enemy gains 1.
- ops: damage, heal, extendEffects

### `summon.night` — Call the Revenant
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Rime Revenant (20 HP) for 3 turns. At the end of each of the user's turns, it deals 15 damage to the last enemy who damaged the user (or a random enemy).
- summons: rime_revenant · ops: summon

### `channel.night` — Winter Solstice
- Channel · cost Ir · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- The user becomes Dormant for 2 turns, and meanwhile, at the end of each of their turns, 10 damage to all enemies. Channeled.
- applies: dormant · inline statuses: winter_solstice · ops: apply, damage
  - inline `winter_solstice` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies.

### `stab.night` — Rime Stiletto
- Stab · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 25 if they're Asleep, without waking them.
- ops: if, damage

### `ravage.night` — Blackfrost Fang
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. If they have Dusk, it deepens by 1; if not, they're Frostbitten and Numb for 2 turns.
- applies: frostbitten, numb · macros: deepen_dusk · ops: damage, if, forEach, macro, apply

### `mislead.night` — False Dawn
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and if they have Dusk, Midnight strikes now. Invisible.
- inline statuses: false_dawn · macros: midnight · ops: apply, if, forEach, macro
  - inline `false_dawn` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and Midnight strikes if they have Dusk.

### `stun.night` — Lulled Under Snow
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and they become Dormant for 1 turn: they can't use skills, and the user's side can't target them.
- applies: dormant_enemy · ops: damage, apply

### `dance.night` — Drowsing Waltz
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 1 Might and 2 Swiftness. The first hit meanwhile that would leave them below 30 HP is stopped at 30, and they become Dormant for 1 turn instead.
- applies: might, swiftness, dormant · inline statuses: drowsing_waltz · ops: apply, if, removeSelf
  - inline `drowsing_waltz` (Buff; triggers: damaged): The first hit that would leave the bearer below 30 HP stops at 30, and they become Dormant.

### `heal.night` — Winter Rest
- Heal · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally heals 15 and becomes Dormant for 1 turn.
- applies: dormant · ops: heal, apply

### `bless.night` — Promise of Dawn
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Nothing happens yet. 2 turns from now, target ally gains 2 Might, 2 Swiftness and 3 Renew for 3 turns.
- applies: might, swiftness, renew · inline statuses: promise_of_dawn · ops: apply
  - inline `promise_of_dawn` (Buff): When this ends, the bearer gains 2 Might, 2 Swiftness and 3 Renew.

### `curse.night` — Starless Sky
- Curse · cost Ar · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains Dusk 4, or has their Dusk deepened by 1. For 2 turns, each skill they use deepens it by 1 more.
- inline statuses: starless_sky · macros: dusk, deepen_dusk · ops: set, forEach, macro, apply
  - inline `starless_sky` (Debuff, hidden; triggers: skillUsed): Each skill the bearer uses deepens their Dusk by 1.

### `smite.night` — Hidden Moon
- Smite · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 20 damage to target enemy, who is Sanctified for 1 turn. The user gains Stealth for 1 turn. Stealthy.
- applies: sanctify, stealth · ops: damage, apply

### `prayer.night` — Hibernal Vigil
- Prayer · cost Irr · cooldown 4 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and become Dormant for 1 turn.
- applies: dormant · ops: heal, apply

### `cleave.night` — Crescent Cleave
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Target enemy and a random other enemy each take 15 damage, plus 5 for each turn of Dusk they have left, and their Dusk ends. Each of them who had no Dusk gains Dusk 4 instead.
- macros: crescent_cut · ops: forEach, macro

### `shout.night` — Hoarfrost Howl
- Shout · cost A · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Meanwhile, each Frost debuff they gain lasts 1 turn longer.
- applies: intimidated · inline statuses: hoarfrost_howl · ops: apply, eventEffect
  - inline `hoarfrost_howl` (Debuff; triggers: effectGained): Each Frost debuff the bearer gains lasts 1 turn longer.

### `withstand.night` — Frostfall Cloak
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn. If an enemy breaks it, the user gains Stealth for 1 turn per Frost debuff that enemy has (max 3).
- applies: stealth · inline statuses: frostfall_cloak · ops: apply, if, set, removeEffect
  - inline `frostfall_cloak` (Buff; triggers: shieldDamaged): A Shield; if an enemy breaks it, Stealth for 1 turn per Frost debuff on the breaker.

### `taunt.night` — Feigned Sleep
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns, then the user becomes Dormant for 1 turn: while the user is Dormant, the Taunted enemy has no one they can target.
- applies: taunt, dormant · ops: apply

### `titan.night` — Sleeping Giant
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Dormant for 2 turns, gaining 20 Shield per turn instead of 10. When they wake, every enemy gains Dusk 2.
- applies: shield, focus · inline statuses: sleeping_giant · macros: dusk · ops: apply, set, forEach, macro
  - inline `sleeping_giant` (Buff; triggers: turnEnd): Can't use skills or be targeted by enemies; gains 20 Shield per turn; wakes with 1 Focus, and every enemy gains Dusk 2.

### `snow_owl_silent_talons` — Silent Talons (minion skill of `snow_owl`)
- Minion · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, 30 against Frozen Sleep.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `snow_owl` — Snow Owl, 25 HP; skills: snow_owl_silent_talons
  - passive `snow_owl_watch` (triggers: turnEnd): At the end of its owner's turn, a random enemy without Dusk gains Dusk 4.
- `rime_revenant` — Rime Revenant, 20 HP; skills: none
  - passive `rime_revenant_vengeance` (triggers: turnEnd): At the end of its owner's turn, deals 15 damage to the last enemy who damaged its summoner (or a random enemy).

## Named statuses defined here (5) — this group owns their default animations

- `dusk` — Dusk (Debuff; triggers: turnStart): Counts down after each of the bearer's turns; at 0, Midnight puts the bearer in Frozen Sleep. _Applied by skills in: none directly._
- `frozen_sleep` — Frozen Sleep (Debuff): Asleep, and damage doesn't wake them. Counts as Frostbitten, Chilled and Numb. Afterwards, First Light for 2 turns. _Applied by skills in: none directly._
- `first_light` — First Light (Neutral): Can't gain Dusk. _Applied by skills in: none directly._
- `dormant` — Dormant (Buff; triggers: turnEnd): Can't use skills or be targeted by enemies (ticking and triggered damage still land). Gains 10 Shield at the end of each of their turns, and wakes with 1 Focus. _Applied by skills in: night._
- `dormant_enemy` — Dormant (Debuff): Can't use skills or be targeted by enemies (ticking and triggered damage still land). _Applied by skills in: night._

## Macros defined here (4) — this group owns their default animations

- `midnight`: ops removeEffect, if, apply; applies frozen_sleep. _Used by: night._
- `dusk`: ops if, macro, apply; applies dusk. _Used by: night._
- `deepen_dusk`: ops if, macro, removeStacks. _Used by: night._
- `crescent_cut`: ops if, damage, removeEffect, set, macro. _Used by: night._
