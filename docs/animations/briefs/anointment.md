# Anointment — animation brief

Group id: `anointment`. Element(s): Water + Holy. Concept file: `docs/animations/concepts/anointment.yaml`.
Skill source: `packages/content/data/fusions/anointment/skills.anointment.yaml`; minions: `packages/content/data/fusions/anointment/minions.anointment.yaml`; statuses: `packages/content/data/fusions/anointment/statuses.anointment.yaml`.

## Skills (33)

### `strike.anointment` — Wave of Blessing
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Every ally of the user gains 1 Might for 1 turn.
- applies: might · ops: damage, apply

### `smash.anointment` — Cascade of Grace
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies. If the user is Anointed, they spend it to cut their other cooldowns by 1 per enemy hit (max 2).
- ops: damage, if, removeEffect, adjustCooldowns

### `charge.anointment` — Pilgrim's Rush
- Charge · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. Until the end of the user's next turn, they have Chrism, and each ally they Anoint through it also gets 1 Focus for their next skill.
- applies: chrism, focus · inline statuses: pilgrims_rush · ops: damage, apply
  - inline `pilgrims_rush` (Buff; triggers: skillResolved): Each ally the bearer Anoints through Chrism also gets 1 Focus.

### `riposte.anointment` — Calm Waters
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user or on any Anointed ally, and whoever it protected gains Flow for 2 turns. Invisible.
- applies: flow · inline statuses: calm_waters · ops: apply, removeEffect
  - inline `calm_waters` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, who gains Flow.

### `rage.anointment` — Fervent Unction
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 2 Unction. For 3 turns, they have 1 Might, and 1 more at the start of each of their turns while they still have Unction.
- applies: unction, might · inline statuses: chrismation · ops: apply, if
  - inline `chrismation` (Buff; triggers: turnStart): At the start of each of the bearer's turns, 1 more Might while they have Unction.

### `shot.anointment` — Holy Sprinkle
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and one of their Buffs, at random, moves to the ally with the lowest HP (the user included). If they have none, that ally gains 1 Unction instead.
- applies: unction · ops: damage, if, stealRandom, apply

### `snipe.anointment` — Lance of the Font
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 30 damage to target enemy, +10 per Debuff on them; then those Debuffs are removed. The target of this skill is invisible. Channeled.
- inline statuses: lance_of_the_font · ops: apply, forEach, damage, removeKind
  - inline `lance_of_the_font` (Neutral): Strikes its target at the end of the following turn, then removes their Debuffs.

### `trap.anointment` — Font Ward
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, whenever target enemy gives an ally of the user a Debuff, they take 15 damage and that ally gains 1 Unction. Invisible.
- applies: unction · inline statuses: font_ward · ops: apply, damage
  - inline `font_ward` (Debuff, hidden; triggers: effectApplied): Each Debuff the bearer gives the applier's side hurts them and gives its target Unction.

### `maneuver.anointment` — Immersion
- Maneuver · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. Every enemy who uses a Harmful skill during it is Condemned.
- applies: invulnerable, condemned · inline statuses: immersion · ops: apply
  - inline `immersion` (Debuff; triggers: skillUsed): Using a Harmful skill Condemns the bearer.

### `companion.anointment` — Sacred Koi
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Sacred Koi (35 HP) permanently. Golden Leap (r): target ally is Anointed until the end of their next turn, or gains Chrism for as long if they already were. Tail Slap (nc): 10 damage.
- summons: sacred_koi · ops: summon

### `bolt.anointment` — Vial of Holy Water
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, and every ally with a Debuff gains 1 Unction. If none has one, the ally with the lowest HP gains it.
- applies: unction · ops: damage, if, apply

### `blast.anointment` — Flood of Grace
- Blast · cost AI · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, +10 for each Anointed ally, the user included.
- ops: damage

### `consume.anointment` — Communion
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy; the user and every Anointed ally heal for the damage dealt.
- ops: damage, heal

### `summon.anointment` — Baptismal Font
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Baptismal Font (25 HP) for 3 turns. Pour (nc): target ally heals 10. While it stands, no unit on either side can gain Debuffs.
- summons: baptismal_font · ops: summon

### `channel.anointment` — Consecrated Rain
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 4 turns, at the end of each of the user's turns, deals 5 damage to all enemies, and each loses a random Buff; for each Buff removed, a random ally gains 1 Unction. Channeled.
- applies: unction · inline statuses: consecrated_rain · ops: apply, damage, set, removeRandom, repeat
  - inline `consecrated_rain` (Neutral; triggers: turnEnd): Each turn, 5 damage to all enemies, a Buff removed from each, and Unction for allies.

### `stab.anointment` — Brine Needle
- Stab · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- The user loses a random Debuff. Then this deals 10 damage to target enemy, or 20 if the user has no Debuffs left.
- ops: removeRandom, damage

### `ravage.anointment` — Scouring Current
- Ravage · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. For 2 turns, while the user has Flow, enemies they hit are Shattered for 1 turn.
- applies: shattered · inline statuses: scouring_current · ops: damage, apply, if
  - inline `scouring_current` (Buff; triggers: dealtDamage): While the bearer has Flow, enemies they hit are Shattered.

### `mislead.anointment` — Turned to Grace
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they're Condemned, and every Debuff on the user's side moves onto them. Invisible.
- applies: condemned · inline statuses: turned_to_grace · ops: apply, moveEffects
  - inline `turned_to_grace` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered; they're Condemned and take on the applier's side's Debuffs.

### `stun.anointment` — Submission
- Stun · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn. While they are, Anointed allies deal 10 more damage to them.
- applies: stun, submission · inline statuses: submission_zeal · ops: apply
  - inline `submission_zeal` (Buff): While Anointed, the bearer deals 10 more damage to the submitted enemy.

### `dance.anointment` — River of Grace
- Dance · cost AI · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Chrism and 2 Swiftness, and allies they Anoint through it gain Chrism too until the end of their next turn.
- applies: chrism, swiftness · inline statuses: river_of_grace · ops: apply
  - inline `river_of_grace` (Buff; triggers: skillResolved): Allies the bearer Anoints gain Chrism too.

### `heal.anointment` — Anointing Oil
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15 and gains 1 Unction, +1 for each Debuff they have.
- applies: unction · ops: heal, apply

### `bless.anointment` — Holy Oil
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 2 turns, target ally can't gain Debuffs; each Harmful skill used on them gives them 1 Unction instead.
- applies: unction · inline statuses: holy_oil · ops: apply
  - inline `holy_oil` (Buff; triggers: skillTargeted): Debuffs become Unction.

### `curse.anointment` — Font of Penance
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy's Buffs are removed, and for 2 turns they can't gain new ones.
- inline statuses: font_of_penance · ops: removeKind, apply
  - inline `font_of_penance` (Debuff): Can't gain Buffs.

### `smite.anointment` — Flowing Brand
- Smite · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the user is Anointed, they lose it, and the ally with the least HP gains Chrism until the end of their next turn.
- applies: chrism · ops: damage, if, removeEffect, apply

### `prayer.anointment` — Sin-Eater's Prayer
- Prayer · cost WW · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. The user then takes on every ally's Debuffs and gains 1 Unction for each.
- applies: unction · ops: heal, forEach, set, apply, moveEffects

### `cleave.anointment` — Penitent's Sweep
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy and 20 to a random other enemy, but the user is Condemned for it.
- applies: condemned · ops: damage, forEach, apply

### `shout.anointment` — General Absolution
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- Every unit in the battle, on both sides, loses all its Debuffs. Then all enemies are Intimidated for 2 turns.
- applies: intimidated · ops: removeKind, apply

### `withstand.anointment` — Shield of the Font
- Withstand · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 2 Unction, then all their Unction works at once: each stack removes a Debuff and gives 15 Shield instead of healing.
- applies: unction, shield · ops: apply, set, removeEffect, repeat, removeRandom

### `taunt.anointment` — Call of the Font
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Summons a Holy Spring (20 HP) for 2 turns; target enemy is Taunted by it for as long. When the Spring expires or is destroyed, every allied character gains 1 Unction.
- applies: taunt · summons: holy_spring · ops: summon, apply

### `titan.anointment` — Living Font
- Titan · cost AI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and 1 Unction at the start of each of their turns, and their Unction cleanses and heals every ally, not just them.
- applies: armor, unction · inline statuses: living_font · ops: apply
  - inline `living_font` (Buff; triggers: turnStart): Gains 1 Unction each turn; the bearer's Unction cleanses and heals every ally.

### `sacred_koi_golden_leap` — Golden Leap (minion skill of `sacred_koi`)
- Minion · cost r · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally is Anointed until the end of their next turn, or gains Chrism for as long if they already were.
- applies: chrism, anointed · ops: if, apply

### `sacred_koi_tail_slap` — Tail Slap (minion skill of `sacred_koi`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

### `baptismal_font_pour` — Pour (minion skill of `baptismal_font`)
- Minion · cost free · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally heals 10.
- ops: heal

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `sacred_koi` — Sacred Koi, 35 HP; skills: sacred_koi_golden_leap, sacred_koi_tail_slap
- `baptismal_font` — Baptismal Font, 25 HP; skills: baptismal_font_pour
- `holy_spring` — Holy Spring, 20 HP; skills: none

## Named statuses defined here (3) — this group owns their default animations

- `unction` — Unction (Buff; triggers: turnEnd): At the end of the applier's turn, one stack is used up to remove one of the bearer's Debuffs and heal them 10. _Applied by skills in: anointment._
- `chrism` — Chrism (Buff; triggers: skillResolved): Counts as Anointed. When the bearer uses a Helpful skill on an ally, that ally is Anointed until the end of their next turn. _Applied by skills in: anointment._
- `submission` — Submission (Debuff): Anointed enemies of the bearer deal 10 more damage to them. _Applied by skills in: anointment._
