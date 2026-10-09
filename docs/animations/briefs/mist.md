# Mist — animation brief

Group id: `mist`. Element(s): Water + Wind. Concept file: `docs/animations/concepts/mist.yaml`.
Skill source: `packages/content/data/fusions/mist/skills.mist.yaml`; minions: `packages/content/data/fusions/mist/minions.mist.yaml`; statuses: `packages/content/data/fusions/mist/statuses.mist.yaml`.

## Skills (31)

### `strike.mist` — Veiled Strike
- Strike · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user gains Fog for 1 turn. When this Fog ends, it gives the user no Renew; instead, that enemy takes 15 damage, or 25 if it redirected a skill.
- inline statuses: veiled_strike · ops: damage, apply, if, setFlag
  - inline `veiled_strike` (Buff; triggers: signal): Fog that gives no Renew when it ends; instead, the struck enemy takes 25 damage if it redirected a skill, else 15.

### `smash.mist` — Gale Spindle
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to their allies. The user spends all their Swiftness; each stack spent adds 10 to every hit.
- ops: set, removeEffect, damage

### `charge.mist` — Mistwalk
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. Until the end of the user's next turn, the next time the user deals direct damage to another enemy with a skill, target enemy takes as much damage too (max 25).
- inline statuses: mistwalk · ops: damage, apply, if, removeSelf
  - inline `mistwalk` (Buff; triggers: dealtDamage): The next direct hit the bearer's skills land on another enemy also deals as much damage to the enemy hit by Mistwalk (max 25).

### `riposte.mist` — Fogbank
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user has Fog and counters the first Harmful skill used on them or on any Fogged ally. Invisible.
- applies: fog · inline statuses: fogbank · ops: apply, removeEffect
  - inline `fogbank` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer (or on any other Fogbanked ally).

### `rage.mist` — Riptide Fury
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user begins Rushing and gains 1 Might; at the end of each of their turns they're still Rushing, they gain 2 Renew.
- applies: rushing, might, renew · inline statuses: riptide_fury · ops: apply, if
  - inline `riptide_fury` (Buff; triggers: turnEnd): Each turn the bearer ends Rushing, they gain 2 Renew.

### `shot.mist` — Dew Shot
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Hits a random enemy instead of target enemy: 20 damage, or 10 if it's target enemy.
- ops: forEach, damage

### `snipe.mist` — Mistpiercer
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 45 damage to target enemy. The user has Fog while it channels; if a hit lands on them anyway, the shot deals 15 less. The target of this skill is invisible. Channeled.
- applies: fog · inline statuses: mistpiercer · ops: apply, setFlag, damage
  - inline `mistpiercer` (Neutral; triggers: damaged): Strikes its target at the end of the following turn; 15 less if the bearer was hit.

### `trap.mist` — Choking Fog
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a single-target Harmful skill, it hits a random unit on its target's side instead, and they gain 1 Confusion. Invisible.
- applies: confusion · inline statuses: choking_fog · ops: apply
  - inline `choking_fog` (Debuff, hidden; triggers: skillUsed): The bearer's skills strike a random unit until their first Harmful one, which also Confuses them.

### `maneuver.mist` — Dissipate
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains Fog for 1 turn. The first time it redirects a skill, the user becomes Invulnerable for 1 turn.
- applies: fog, invulnerable · inline statuses: dissipate · ops: apply, if, removeSelf
  - inline `dissipate` (Buff; triggers: signal): The first skill the bearer's Fog redirects away from them makes them Invulnerable for 1 turn.

### `companion.mist` — Mist Heron
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Mist Heron (35 HP) permanently. It always has Fog. Spear Beak (r): 15 damage to target enemy, +10 if they're Immobile.
- summons: mist_heron · ops: summon

### `bolt.mist` — Burst Spring
- Bolt · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Every ally's Renew heals once now, without losing a stack.
- ops: damage, forEach, heal

### `blast.mist` — Drowning Squall
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. For 2 turns, each Confusion an enemy gains comes with 1 Intimidated for as long.
- applies: intimidated · inline statuses: drowning_squall · ops: damage, apply
  - inline `drowning_squall` (Debuff; triggers: effectGained): Each Confusion the bearer gains comes with 1 Intimidated for as long.

### `consume.mist` — Condensation
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. If that enemy was healed since the user's last turn, the user heals 20 more.
- ops: damage, heal

### `summon.mist` — Mist Double
- Summon · cost I · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons a Mist Double of the user for 2 turns. The first enemy single-target Harmful skill aimed at the user strikes the Double instead. The Double can't be hurt, but any enemy Harmful skill that strikes it destroys it, and that skill's user takes 10 damage. When it expires or is destroyed, the user gains Fog for 1 turn.
- inline statuses: mist_double_decoy · summons: mist_double · ops: summon, apply
  - inline `mist_double_decoy` (Buff): The first enemy single-target Harmful skill aimed at the bearer strikes their Mist Double instead.

### `channel.mist` — Rolling Fog
- Channel · cost II · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 2 turns, at the end of each of the user's turns, deals 10 damage to all enemies. All allies have Fog while it lasts, and enemies whose skills it redirects gain 1 Confusion. Channeled.
- applies: confusion, fog · inline statuses: rolling_fog · ops: apply, damage
  - inline `rolling_fog` (Neutral; triggers: turnEnd, signal): Each turn, 10 damage to all enemies; enemies whose skills the Fog redirects are Confused.

### `stab.mist` — Whisper Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. Until the user's next turn, the first time an ally of the user deals that enemy direct damage while they're at or below 60 HP, they take 15 more damage.
- inline statuses: whisper_knife · ops: damage, apply, if, removeSelf
  - inline `whisper_knife` (Debuff; triggers: damaged): The first direct hit from the applier's side while the bearer is at or below 60 HP deals them 15 more damage.

### `ravage.mist` — Undertow Thrust
- Ravage · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, +5 per Renew the user has (max 20). Then the user loses all Renew and Leaps.
- macros: leap · ops: damage, removeEffect, forEach, macro

### `mislead.mist` — Lost in the Fog
- Mislead · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered. If it was aimed at a single unit, it's used on a random one of their own allies instead (if they have any). Invisible.
- inline statuses: lost_in_the_fog · ops: apply, if, castSkill
  - inline `lost_in_the_fog` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered; a single-target one lands on a random ally of theirs instead.

### `stun.mist` — Squall in the Fog
- Stun · cost r · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- A random enemy takes 15 damage and is Stunned for 2 turns.
- applies: stun · ops: forEach, damage, apply

### `dance.mist` — Rain Dance
- Dance · cost Ar · cooldown 5 · target **self** · tags Helpful, Strategic
- For 4 turns, the user has Fog, and each time it redirects a skill, they gain 1 Swiftness and 1 Focus.
- applies: fog, swiftness, focus · inline statuses: rain_dance · ops: apply, if
  - inline `rain_dance` (Buff; triggers: signal): Each skill the bearer's Fog redirects gives them 1 Swiftness and 1 Focus.

### `heal.mist` — Morning Dew
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. If they have Fog, it ends now, and they gain 4 Renew instead of 2.
- applies: renew · ops: heal, if, removeEffect, apply

### `bless.mist` — Cloak of Mist
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Renew, and has Fog for 3 turns or until they use a Harmful skill.
- applies: renew · inline statuses: cloak_of_mist · ops: apply
  - inline `cloak_of_mist` (Buff): The bearer has Fog until they use a Harmful skill.

### `curse.mist` — Heavy Air
- Curse · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy counts as Immobile for 2 turns, whatever skills or buffs they have, and gains 1 Weakness.
- applies: weakness · inline statuses: heavy_air · ops: apply
  - inline `heavy_air` (Debuff): The bearer counts as Immobile.

### `smite.mist` — Dewfall Ring
- Smite · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, whenever they deal direct damage to one of the user's allies, that ally gains Fog for 1 turn.
- applies: fog · inline statuses: dewfall_ring · ops: damage, apply
  - inline `dewfall_ring` (Debuff; triggers: dealtDamage): Each of the applier's allies the bearer deals direct damage to gains Fog for 1 turn.

### `prayer.mist` — Mercy of the Mist
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and gain Fog for 1 turn that gives no Renew when it ends. Instead, while it lasts, each skill Fog redirects heals every ally 10.
- inline statuses: mercy_of_the_mist, mercy_of_the_mist_heal · ops: heal, apply
  - inline `mercy_of_the_mist` (Buff): Fog that gives no Renew when it ends.
  - inline `mercy_of_the_mist_heal` (Buff; triggers: signal): Each skill Fog redirects on the bearer's side heals every ally 10.

### `cleave.mist` — Mistcutter
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the user has Fog, it ends without giving Renew, and every other enemy takes 15 damage. If they don't, a random other enemy takes 10 damage, and the user gains Fog until the end of their next 2 turns.
- applies: fog · ops: damage, if, removeEffect, forEach, apply

### `shout.mist` — Foghorn
- Shout · cost I · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- 3 times, a random enemy character is Intimidated for 2 turns (it can be the same one).
- applies: intimidated · ops: repeat, forEach, apply

### `withstand.mist` — Veil of Mist
- Withstand · cost r · cooldown 1 · target **self** · tags Helpful, Strategic
- The user gains 15 Shield for 1 turn. If they have Fog, it ends now, and they gain 15 more Shield and its 2 Renew.
- applies: shield, renew · ops: if, removeEffect, apply

### `taunt.mist` — Voice in the Fog
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, target enemy's single-target Harmful skills hit the user instead, whoever they aim at. Invisible.
- inline statuses: voice_in_the_fog · ops: apply
  - inline `voice_in_the_fog` (Debuff, hidden): The bearer's single-target Harmful skills land on the applier, whoever they aim at.

### `titan.mist` — Marid Form
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune and Fog, and each of their skills that deals direct damage also deals 10 damage to a random enemy.
- applies: immune, fog · inline statuses: marid_form · ops: apply, setFlag, if, damage
  - inline `marid_form` (Buff; triggers: dealtDamage, skillResolved): Each of the bearer's skills that deals direct damage also deals 10 damage to a random enemy.

### `mist_heron_spear_beak` — Spear Beak (minion skill of `mist_heron`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, +10 if they're Immobile.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `mist_heron` — Mist Heron, 35 HP; skills: mist_heron_spear_beak
  - passive `mist_heron_fog`: The Heron always has Fog.
- `mist_double` — Mist Double, 20 HP; skills: none
  - passive `mist_double_burst` (triggers: skillTargeted): Can't be hurt. The first enemy Harmful skill that strikes it destroys it, and that skill's user takes 10 damage.

## Named statuses defined here (1) — this group owns their default animations

- `fog` — Fog (Buff): Enemy single-target skills aimed at the bearer hit a random unit on their side instead. When Fog ends, the bearer gains 2 Renew. _Applied by skills in: mist._
