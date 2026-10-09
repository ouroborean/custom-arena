# Sanctuary — animation brief

Group id: `sanctuary`. Element(s): Earth + Holy. Concept file: `docs/animations/concepts/sanctuary.yaml`.
Skill source: `packages/content/data/fusions/sanctuary/skills.sanctuary.yaml`; minions: `packages/content/data/fusions/sanctuary/minions.sanctuary.yaml`; statuses: `packages/content/data/fusions/sanctuary/statuses.sanctuary.yaml`; macros: `packages/content/data/fusions/sanctuary/macros.sanctuary.yaml`.

## Skills (33)

### `strike.sanctuary` — Toppled Idol
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they have more HP than the user, they take 10 more and are Condemned.
- applies: condemned · ops: if, damage, apply

### `smash.sanctuary` — Cracking Foundation
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies. Each allied Boulder loses 15 HP and adds 5 to every hit.
- ops: set, damage

### `charge.sanctuary` — Pilgrim's Stride
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user's ally with the lowest HP (the user included) gains 15 Shield for 1 turn.
- applies: shield · ops: damage, apply

### `riposte.sanctuary` — Sheltering Stone
- Riposte · cost W · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, or on each ally if your Sanctum is at 3; its user takes 10 Piercing damage. Invisible.
- inline statuses: sheltering_stone · ops: apply, damage
  - inline `sheltering_stone` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user takes 10 Piercing.

### `rage.sanctuary` — Temple Within
- Rage · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- Your Sanctum ends, and for 3 turns the user gains Immune and 1 Might and 1 Armor per level it had (at least 1).
- applies: immune, might, armor · ops: set, removeEffect, apply

### `shot.sanctuary` — Hallowed Sling
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user gains 1 Armor for 2 turns.
- applies: armor · ops: damage, apply

### `snipe.sanctuary` — Obelisk
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- The user creates a Wardstone now. In 2 turns, deals 50 damage to target enemy, +20 if an allied Wardstone still stands. Channeled.
- inline statuses: obelisk · summons: wardstone · ops: summon, apply, damage
  - inline `obelisk` (Neutral): When this runs out, its target takes 50 damage, +20 with an allied Wardstone standing.

### `trap.sanctuary` — Sacred Boundary
- Trap · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy damages one of the user's allies, they take 15 damage and your Sanctum rises by 1. Invisible.
- inline statuses: sacred_boundary · macros: raise_sanctum · ops: apply, damage, macro
  - inline `sacred_boundary` (Debuff, hidden; triggers: dealtDamage): The first time the bearer damages one of the applier's allies, they take 15 and the Sanctum rises.

### `maneuver.sanctuary` — Take Sanctuary
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. If your Sanctum is at 3, it drops to 1 and every ally becomes Invulnerable instead.
- applies: invulnerable · ops: if, removeStacks, apply

### `companion.sanctuary` — Temple Warden
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Temple Warden (50 HP, counts as a Wardstone) permanently. Stone Fist (nc): 10 damage. Bless the Ground (r): your Sanctum rises by 1.
- summons: temple_warden · ops: summon

### `bolt.sanctuary` — Stone Rebuke
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Condemns them. When that Condemnation resolves, they take 10 more damage and your Sanctum rises by 1.
- applies: condemned · inline statuses: stone_rebuke · macros: raise_sanctum · ops: damage, apply, if, macro, removeSelf
  - inline `stone_rebuke` (Debuff; triggers: skillUsed): When the bearer's Condemnation resolves, they take 10 damage and the applier's Sanctum rises by 1.

### `blast.sanctuary` — Tremor of Faith
- Blast · cost IW · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to all enemies, +10 per level of your Sanctum; then your Sanctum drops by 1.
- macros: lower_sanctum · ops: damage, macro

### `consume.sanctuary` — Holy Harvest
- Consume · cost W · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it, and Sanctifies them for 1 turn. The first time that Sanctify heals someone, the user creates a Wardstone.
- applies: sanctify · inline statuses: holy_harvest · summons: wardstone · ops: set, damage, heal, apply, if, summon, removeSelf
  - inline `holy_harvest` (Debuff; triggers: damaged): The first direct hit on the Sanctified bearer creates a Wardstone for the applier.

### `summon.sanctuary` — Stonemason
- Summon · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Stonemason (20 HP) for 3 turns. Carve (r): creates a Boulder, or a Wardstone if your Sanctum is at 2 or more.
- summons: stonemason · ops: summon

### `channel.sanctuary` — Build the Sanctuary
- Channel · cost Ir · cooldown 3 · target **self** · tags Helpful, Strategic, Channeled
- For 3 turns, at the end of each of the user's turns, your Sanctum rises by 1; if it's already at 3, all enemies take 10 damage instead. Channeled.
- inline statuses: build_the_sanctuary · macros: raise_sanctum · ops: apply, if, damage, macro
  - inline `build_the_sanctuary` (Neutral; triggers: turnEnd): Each turn, the Sanctum rises by 1, or at 3, all enemies take 10 damage.

### `stab.sanctuary` — Penitent's Awl
- Stab · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 at or below 60 HP. If they're Condemned, it resolves now, as if they'd used a skill; otherwise they're Condemned.
- applies: weakness, vulnerable, confusion, condemned · ops: damage, if, removeEffect, random, apply

### `ravage.sanctuary` — Ramstone Drill
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, +5 per Armor the user has. Then the user loses 1 Armor.
- ops: damage, removeStacks

### `mislead.sanctuary` — Right of Asylum
- Mislead · cost W · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the first Harmful skill an enemy uses on each of the user's other allies is countered. Invisible.
- inline statuses: right_of_asylum · ops: apply
  - inline `right_of_asylum` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer.

### `stun.sanctuary` — Penance in Stone
- Stun · cost Ar · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn, +1 turn for each allied Wardstone (up to 3 turns in all).
- applies: stun · ops: set, apply

### `dance.sanctuary` — Stately Measure
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 4 turns, at the start of each of the user's turns, they gain 1 Might, 1 Armor and 1 Focus (max 3 each). It all ends if they use a mobility skill.
- applies: stately_might, armor, focus · inline statuses: stately_measure · ops: apply, if, removeSelf
  - inline `stately_measure` (Buff; triggers: turnStart, skillUsed): Each turn, +1 Might, Armor and Focus (max 3 each); a mobility skill ends it all.

### `heal.sanctuary` — Day of Rest
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. If they use no Harmful skill on their next turn, they heal 30 more at its end.
- inline statuses: day_of_rest · ops: heal, apply, removeSelf
  - inline `day_of_rest` (Buff; triggers: skillUsed): If the bearer uses no Harmful skill this turn, they heal 30 at its end.

### `bless.sanctuary` — Stone Vow
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might, and while an allied Wardstone stands, it takes half the damage they would.
- applies: might · inline statuses: stone_vow · ops: apply, if, set, heal, damage
  - inline `stone_vow` (Buff; triggers: damaged): While an allied Wardstone stands, it takes half the damage the bearer would; the bearer gets that back.

### `curse.sanctuary` — Excommunicate
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Your Sanctum drops by 1. Target enemy is Isolated for 3 turns and Condemned.
- applies: isolated, condemned · macros: lower_sanctum · ops: macro, apply

### `smite.sanctuary` — Firstfruits Tithe
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy; they lose 10 max HP, and the ally with the lowest HP (the user included) gains 10 max HP and heals 10, both for the rest of the match. Each enemy character can lose max HP to this 3 times at most; minions can't.
- ops: damage, if, setCounter, addMaxHp, forEach, heal

### `prayer.sanctuary` — Cornerstone Psalm
- Prayer · cost Wrr · cooldown 4 · target **allAllies** · tags Helpful, Strategic
- All allies gain 10 max HP for the rest of the match and heal 15.
- ops: addMaxHp, heal

### `cleave.sanctuary` — Shieldbearer's Sweep
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to a random other enemy. For 2 turns, the first direct hit on each of them gives its damager 15 Shield for 1 turn.
- applies: shieldbearer · ops: damage, apply, forEach

### `shout.sanctuary` — Call to the Faithful
- Shout · cost A · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- Every allied Boulder that isn't a Wardstone yet becomes one; if there's none, the user creates a Wardstone. All enemies are Intimidated for 2 turns.
- applies: intimidated · summons: wardstone · ops: if, forEach, transformMinion, summon, apply

### `withstand.sanctuary` — Rampart of Faith
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn, +10 per allied Boulder and Wardstone; each of those loses 10 HP.
- applies: shield · ops: set, apply, damage

### `taunt.sanctuary` — Unceasing Challenge
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- The user creates a Wardstone. Target enemy is Taunted by it for 2 turns and Condemned each time they hit it.
- applies: taunt, condemned · inline statuses: unceasing_challenge · summons: wardstone · ops: summon, apply, if
  - inline `unceasing_challenge` (Debuff; triggers: dealtDamage): Each time the bearer hits a Wardstone, they're Condemned.

### `titan.sanctuary` — Living Temple
- Titan · cost WW · cooldown 4 · target **self** · tags Helpful, Strategic
- Your Sanctum rises by 1. For 3 turns, the user counts as a Wardstone and gains 2 Armor and Immune.
- applies: living_temple, armor, immune · macros: raise_sanctum · ops: macro, apply

### `warden_stone_fist` — Stone Fist (minion skill of `temple_warden`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

### `warden_bless_the_ground` — Bless the Ground (minion skill of `temple_warden`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- Your Sanctum rises by 1.
- macros: raise_sanctum · ops: macro

### `stonemason_carve` — Carve (minion skill of `stonemason`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- Creates a Boulder, or a Wardstone if your Sanctum is at 2 or more.
- summons: wardstone, boulder · ops: if, summon

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `wardstone` — Wardstone, 45 HP; skills: none
- `temple_warden` — Temple Warden, 50 HP; skills: warden_stone_fist, warden_bless_the_ground
- `stonemason` — Stonemason, 20 HP; skills: stonemason_carve

## Named statuses defined here (5) — this group owns their default animations

- `sanctum` — Sanctum (Buff; triggers: turnEnd): At the end of each of its side's turns, every ally gains 1 Armor per level (until that side's next turn) and heals 5 per level; at level 3, allies can't be Stunned. Doesn't run out while an allied Wardstone stands. _Applied by skills in: none directly._
- `sanctum_steady` — Steadfast (Sanctum) (Buff): Can't be Stunned. _Applied by skills in: none directly._
- `living_temple` — Living Temple (Buff): The bearer counts as a Wardstone. _Applied by skills in: sanctuary._
- `stately_might` — Might (Stately Measure) (Buff): +5 direct damage dealt per stack. _Applied by skills in: sanctuary._
- `shieldbearer` — Shieldbearer's Mark (Debuff; triggers: damaged): The first direct hit on the bearer gives the damager 15 Shield for 1 turn. _Applied by skills in: sanctuary._

## Macros defined here (2) — this group owns their default animations

- `raise_sanctum`: ops if, apply; applies sanctum. _Used by: sanctuary._
- `lower_sanctum`: ops removeStacks. _Used by: sanctuary._
