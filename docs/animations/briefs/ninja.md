# Ninja — animation brief

Group id: `ninja`. Element(s): Wind + Shadow. Concept file: `docs/animations/concepts/ninja.yaml`.
Skill source: `packages/content/data/fusions/ninja/skills.ninja.yaml`; minions: `packages/content/data/fusions/ninja/minions.ninja.yaml`; statuses: `packages/content/data/fusions/ninja/statuses.ninja.yaml`; macros: `packages/content/data/fusions/ninja/macros.ninja.yaml`.

## Skills (32)

### `strike.ninja` — Twin Strike
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy; the user creates a Clone if they have none.
- macros: make_clone · ops: damage, if, macro

### `smash.ninja` — Whirlwind of Blades
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to the others. If the user has 3 Clones, each is destroyed and deals 10 damage to a random enemy; otherwise the user creates a Clone.
- macros: make_clone · ops: damage, if, forEach, kill, macro

### `charge.ninja` — Blur
- Charge · cost r · cooldown 1 · target **self** · tags Helpful, Strategic
- The user creates a Clone, and their next Harmful skill Flurries twice.
- inline statuses: blur · macros: make_clone · ops: macro, apply
  - inline `blur` (Buff): The bearer's next Harmful skill Flurries twice.

### `riposte.ninja` — Log Trick
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; the user creates a Clone, then that skill's user takes 10 Piercing damage per Clone the user has. Invisible.
- inline statuses: log_trick · macros: make_clone · ops: apply, macro, damage
  - inline `log_trick` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; the bearer creates a Clone, then that skill's user takes 10 Piercing damage per Clone.

### `rage.ninja` — Shadow Army
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- The user creates 2 Clones. For 3 turns, they're Immune and gain 1 Might whenever one of their Clones is destroyed.
- applies: immune, might · inline statuses: shadow_army · macros: make_clone · ops: macro, apply
  - inline `shadow_army` (Buff; triggers: signal): Each Clone destroyed gives 1 Might while this lasts.

### `shot.ninja` — Shuriken
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Three separate hits of 5 damage to target enemy. Everything that adds to or cuts a hit, like Might, Vulnerable or Armor, applies to each.
- ops: damage

### `snipe.ninja` — Hidden Needle
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, Strategic, Channeled, HiddenTarget
- On the following turn, target enemy loses half their current HP as Affliction damage. The target of this skill is invisible. Channeled.
- inline statuses: hidden_needle · ops: apply, forEach, damage
  - inline `hidden_needle` (Neutral): At the end of the following turn, its target loses half their current HP.

### `trap.ninja` — Paper Seal
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, whenever target enemy gains a Buff, they take 10 Piercing damage and the Buff lasts 1 turn less. Invisible.
- inline statuses: paper_seal · ops: apply, damage, eventEffect
  - inline `paper_seal` (Debuff, hidden; triggers: effectGained): Each Buff the bearer gains deals them 10 Piercing damage and lasts 1 turn less.

### `maneuver.ninja` — Vanishing Smoke
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user destroys a Clone, if they have one, to gain Stealth; otherwise they become Invulnerable for 1 turn and create a Clone.
- applies: stealth, invulnerable · macros: make_clone · ops: if, kill, apply, macro

### `companion.ninja` — Ninken
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Ninken (30 HP) permanently. Snap (r): 10 Piercing damage. Track (r, cooldown 2): every enemy loses Stealth and can't gain it for 1 turn.
- summons: ninken · ops: summon

### `bolt.ninja` — Pinning Kunai
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Marked for 1 turn. For as long, they can't gain mobility buffs, and they lose their Swiftness.
- applies: mark · inline statuses: pinning_kunai · ops: damage, apply, removeEffect
  - inline `pinning_kunai` (Debuff): Can't gain mobility buffs.

### `blast.ninja` — Thousand Blades
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. If the user has no Clones, they create 3 first.
- macros: make_clone · ops: if, macro, damage

### `consume.ninja` — Steal Sight
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it; then the user destroys all their Clones, healing 10 per Clone, or creates one if they have none.
- macros: make_clone · ops: damage, set, if, kill, heal, macro

### `summon.ninja` — Shadow Doubles
- Summon · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user creates 3 Clones.
- macros: make_clone · ops: macro

### `channel.ninja` — Blade Tornado
- Channel · cost AI · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 2 turns, at the end of each of the user's turns, they create a Clone; then 10 damage to all enemies, and every Clone Flurries each of them. Channeled.
- inline statuses: blade_tornado · macros: make_clone · ops: apply, macro, damage
  - inline `blade_tornado` (Neutral; triggers: turnEnd): Each turn, a new Clone, 10 damage to all enemies, and a Flurry on each.

### `stab.ninja` — Second Draw
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, and a Clone is set on them (a new one, unless the user already has 3): if it's still alive at the start of the user's next turn, it deals them 15 damage and is destroyed.
- inline statuses: blind_spot · macros: make_clone · ops: damage, if, macro, apply, kill, forEach
  - inline `blind_spot` (Neutral): At the start of its owner's next turn, the bearer deals 15 damage to the enemy it was set on and is destroyed.

### `ravage.ninja` — Quickdraw
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- For 1 turn, the first time target enemy uses a skill, they take 30 Piercing damage before it takes effect; if they use none, they take 20 Piercing damage as the turn ends.
- inline statuses: quickdraw · ops: apply, damage
  - inline `quickdraw` (Debuff; triggers: skillUsed): The bearer's next skill deals them 30 Piercing damage first; if they use none, 20 when this ends.

### `mislead.ninja` — Feint
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and the user Leaps. If they don't, the user is Marked for 1 turn. Invisible.
- applies: mark · inline statuses: feint · macros: leap · ops: apply, forEach, macro
  - inline `feint` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered and the applier Leaps; if they use none, the applier is Marked.

### `stun.ninja` — Pressure Point
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. At the end of their next turn, they're Stunned for 1 turn.
- applies: stun · inline statuses: pressure_point · ops: damage, apply
  - inline `pressure_point` (Debuff): At the end of the bearer's next turn, they're Stunned for 1 turn.

### `dance.ninja` — Shadow Dance
- Dance · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains Stealth, 2 Clones and 1 Might for 3 turns; meanwhile, a skill that would end their Stealth destroys a Clone instead.
- applies: stealth, might · inline statuses: shadow_dance · macros: make_clone · ops: apply, macro, if, kill
  - inline `shadow_dance` (Buff; triggers: skillUsed): While the bearer has a Clone, their skills are Stealthy; each non-Stealthy skill costs a Clone.

### `heal.ninja` — Field Dressing
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 30 and falls Asleep for 2 turns; when they wake, they begin Rushing and gain 1 Swiftness.
- applies: sleep, rushing, swiftness · inline statuses: field_dressing · ops: heal, apply
  - inline `field_dressing` (Neutral; triggers: ownEffectEnded): When the bearer wakes, they begin Rushing with 1 Swiftness.

### `bless.ninja` — Cloak of Shadows
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Swiftness, and the user creates a Clone; for 2 turns, the user's Clones Substitute for that ally too.
- applies: swiftness, substitution · macros: make_clone · ops: apply, macro, forEach

### `curse.ninja` — Haunting Shadows
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- The user creates a Clone. For 2 turns, each skill target enemy uses draws a Flurry on them.
- inline statuses: haunting_shadows · macros: make_clone · ops: macro, apply, damage
  - inline `haunting_shadows` (Debuff; triggers: skillUsed): Each skill the bearer uses draws a Flurry on them (5 Piercing per Clone on the applier's side).

### `smite.ninja` — Shadow Mark
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each ally who damages them gives the user a Clone.
- inline statuses: shadow_mark · macros: make_clone · ops: damage, apply, macro
  - inline `shadow_mark` (Debuff; triggers: damaged): Each hit from the applier's side gives the applier a Clone.

### `prayer.ninja` — Scatter
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. For 1 turn, each ally an enemy skill targets gains Stealth.
- applies: stealth · inline statuses: scatter · ops: heal, apply
  - inline `scatter` (Buff; triggers: skillTargeted): When targeted by an enemy skill, the bearer gains Stealth.

### `cleave.ninja` — Shadow Whirl
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- The user creates a Clone. Deals 10 damage to target enemy, and this skill's Flurry hits every enemy, not just them. Stealthy.
- macros: make_clone · ops: macro, damage

### `shout.ninja` — Smoke Bomb
- Shout · cost A · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Then every character on both sides, the user included, gains Stealth for 2 turns.
- applies: intimidated, stealth · ops: apply

### `withstand.ninja` — Shadow Guard
- Withstand · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- The user creates a Clone, then each of their Clones gains 20 Shield for 1 turn.
- applies: shield · macros: make_clone · ops: macro, apply

### `taunt.ninja` — Mocking Shadows
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Every Clone on the user's side is destroyed, and target enemy is Taunted by the user for 1 turn, plus 1 turn per Clone destroyed (up to 3 turns).
- applies: taunt · ops: set, kill, apply

### `titan.ninja` — Shadow Master
- Titan · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user creates Clones until they have 2. For 3 turns, they gain Immune, and enemies can't target them until their side has no Clones left.
- applies: immune · inline statuses: shadow_master · macros: make_clone · ops: repeat, if, macro, apply, removeSelf
  - inline `shadow_master` (Buff; triggers: signal): Enemies can't target the bearer until their side has no Shadow Clones left.

### `ninken_snap` — Snap (minion skill of `ninken`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy.
- ops: damage

### `ninken_track` — Track (minion skill of `ninken`)
- Minion · cost r · cooldown 2 · target **self** · tags Harmful, Strategic
- Every enemy, Stealthed or not, loses Stealth and can't gain it for 1 turn.
- inline statuses: tracked · ops: removeEffect, apply
  - inline `tracked` (Debuff): Can't gain Stealth.

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `shadow_clone` — Shadow Clone, 5 HP; skills: none
- `ninken` — Ninken, 30 HP; skills: ninken_snap, ninken_track

## Named statuses defined here (2) — this group owns their default animations

- `ninja_flurry` — Flurry (Neutral; triggers: skillResolved): Each Harmful skill this character uses also deals each enemy it hit 5 Piercing per Shadow Clone. _Applied by skills in: none directly._
- `substitution` — Substitution (Buff): The first single-target enemy skill aimed at the bearer each turn hits a Shadow Clone instead. _Applied by skills in: ninja._

## Macros defined here (1) — this group owns their default animations

- `make_clone`: ops if, summon. _Used by: ninja._
