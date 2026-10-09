# Prism — animation brief

Group id: `prism`. Element(s): Ice + Holy. Concept file: `docs/animations/concepts/prism.yaml`.
Skill source: `packages/content/data/fusions/prism/skills.prism.yaml`; minions: `packages/content/data/fusions/prism/minions.prism.yaml`; statuses: `packages/content/data/fusions/prism/statuses.prism.yaml`; macros: `packages/content/data/fusions/prism/macros.prism.yaml`.

## Skills (32)

### `strike.prism` — Glintstrike
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Refract; if the refracted hit lands on a Frostbitten enemy, it's full strength.
- ops: if, damage, forEach

### `smash.prism` — Lightfall
- Smash · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to their allies. At the start of the user's next turn, each of them who still has a Frost debuff takes 10 more.
- inline statuses: lightfall · ops: damage, apply, if
  - inline `lightfall` (Debuff): At the start of the applier's next turn, 10 damage if the bearer still has a Frost debuff.

### `charge.prism` — Lightspeed
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user's next skill costs nothing, but its cooldown is 2 turns longer.
- inline statuses: lightspeed · ops: damage, apply
  - inline `lightspeed` (Buff): The bearer's next skill costs nothing, but its cooldown is 2 turns longer.

### `riposte.prism` — Spectrum Ward
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, which Refracts instead: a random ally of its user takes 15 damage. Invisible.
- inline statuses: spectrum_ward · ops: apply, damage
  - inline `spectrum_ward` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; it Refracts instead: a random ally of its user takes 15 damage.

### `rage.prism` — Burning Glass
- Rage · cost I · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune. They gain Lens, and each time they use a skill with Lens meanwhile, they gain 1 Might until this ends.
- applies: immune · inline statuses: burning_glass, burning_glass_heat · macros: gain_lens · ops: apply, forEach, macro, if
  - inline `burning_glass` (Buff; triggers: skillUsed): Each skill the bearer uses with Lens gives them 1 Might until this ends.
  - inline `burning_glass_heat` (Buff): +5 direct damage per stack until Burning Glass ends.

### `shot.prism` — Glint Shot
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If they use a Helpful skill on their next turn, they're Numb for 2 turns afterward.
- applies: numb · inline statuses: glint_shot · ops: damage, apply
  - inline `glint_shot` (Debuff; triggers: skillResolved): A Helpful skill on the bearer's next turn Numbs them for 2 turns.

### `snipe.prism` — Focal Point
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 30 Piercing damage to target enemy and 15 Piercing damage to each other enemy. The target of this skill is invisible. Channeled.
- inline statuses: focal_point · ops: apply, forEach, damage
  - inline `focal_point` (Neutral): At the end of the following turn, deals 30 Piercing damage to its target and 15 to every other enemy.

### `trap.prism` — Standing Decree
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a Harmful skill, they're Frostbitten for 2 turns, and it Refracts: a random ally of theirs is Frostbitten for 2 turns too. Invisible.
- applies: frostbitten · inline statuses: standing_decree · ops: apply
  - inline `standing_decree` (Debuff, hidden; triggers: skillUsed): The bearer's next Harmful skill Frostbites them and a random ally of theirs.

### `maneuver.prism` — Afterglow
- Maneuver · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. At the start of their next turn, the last skill they used before this one comes off cooldown, and their next skill costs nothing.
- applies: invulnerable · inline statuses: afterglow, afterglow_free · ops: apply, resetCooldown
  - inline `afterglow` (Buff): At the start of the bearer's next turn, their next skill costs nothing.
  - inline `afterglow_free` (Buff): The bearer's next skill costs nothing.

### `companion.prism` — Lumen Elk
- Companion · cost II · cooldown 4 · target **self** · tags Helpful, Strategic
- Summons a Lumen Elk (45 HP) permanently. Antler Glow (W): target ally gains Lens. Gore (r): 15 damage to target enemy, and Sanctified for 1 turn.
- summons: lumen_elk · ops: summon

### `bolt.prism` — Splinter of Light
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and gives them Splinter of Light. At the start of the user's next turn, they take 15 damage and a random ally of theirs takes 10. Healing them first removes it.
- inline statuses: splinter_of_light · ops: damage, apply, removeSelf
  - inline `splinter_of_light` (Debuff; triggers: healed): At the start of the applier's next turn, the bearer takes 15 damage and a random ally of theirs takes 10. Healing the bearer removes it.

### `blast.prism` — Colorless Nova
- Blast · cost AI · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to all enemies. Each of them loses a Buff.
- ops: damage, removeRandom

### `consume.prism` — Harvest of Grace
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. Every Sanctify on the enemy side ends, and the user heals 15 for each; if there were none, the target is Sanctified for 2 turns.
- applies: sanctify · ops: damage, set, if, removeEffect, heal, apply

### `summon.prism` — Hovering Prism
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Hovering Prism (10 HP) for 3 turns. While it stands, the user's direct hits Refract to a random other enemy at half strength.
- summons: hovering_prism · ops: summon

### `channel.prism` — Dispersion
- Channel · cost I · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, deals 10 damage to target enemy, who is Sanctified for 1 turn; it Refracts to 1 more enemy each turn (5 damage and Sanctify). Channeled.
- applies: sanctify · inline statuses: dispersion · ops: setCounter, apply, damage, repeat, forEach
  - inline `dispersion` (Neutral; triggers: turnEnd): Each turn, 10 damage and Sanctify on the target, refracting to one more enemy each time.

### `stab.prism` — Focused Needle
- Stab · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're Condemned or Frostbitten. If it deals only 10, the user gains Lens.
- macros: gain_lens · ops: if, damage, forEach, macro

### `ravage.prism` — Converging Light
- Ravage · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy, +10 for each of their allies who is Condemned or Sanctified.
- ops: damage

### `mislead.prism` — Caught Light
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and every unit it targeted gains Lens. Invisible.
- inline statuses: caught_light · macros: gain_lens · ops: apply, forEach, macro
  - inline `caught_light` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and its targets gain Lens.

### `stun.prism` — Shattering Awe
- Stun · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If they have Frost debuffs, those all end, and they're Stunned for 1 turn and Condemned for 1 turn per Frost debuff ended; otherwise they're Frostbitten for 1 turn.
- applies: stun, condemned, frostbitten · ops: damage, set, if, removeEffect, apply

### `dance.prism` — Halo of Ice
- Dance · cost AI · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune and gains Lens at the start of each of their turns. While they have Lens, they're Invulnerable.
- applies: immune · inline statuses: halo_of_ice · macros: gain_lens · ops: apply, forEach, macro
  - inline `halo_of_ice` (Buff; triggers: turnStart): Gains Lens at the start of each of the bearer's turns; Invulnerable while they have Lens.

### `heal.prism` — Diffused Light
- Heal · cost Wr · cooldown 3 · target **ally** · tags Helpful, Strategic
- Target ally heals 40. It Refracts to the ally with the least HP (if another) for 20.
- ops: heal, if

### `bless.prism` — Lens of Favor
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Lens. When they spend it, it Refracts: a random other ally gains Lens.
- inline statuses: lens_of_favor · macros: gain_lens · ops: forEach, macro, apply, if, removeSelf
  - inline `lens_of_favor` (Buff; triggers: ownEffectEnded): When the blessed ally spends their Lens, a random other ally gains Lens.

### `curse.prism` — Split Verdict
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Condemned until the end of the user's next turn. It Refracts as Sanctify: a random ally of theirs is Sanctified for as long.
- applies: condemned, sanctify · ops: apply, if

### `smite.prism` — Glacial Rebuke
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Until the end of the enemy's next turn, the first time an enemy deals direct damage to the user's ally with the least HP, that ally heals 15 and that enemy is Frostbitten for 1 turn.
- applies: frostbitten · inline statuses: glacial_rebuke · ops: damage, apply, heal
  - inline `glacial_rebuke` (Buff; triggers: damaged): The first enemy direct hit on the bearer heals them 15 and Frostbites that enemy for 1 turn.

### `prayer.prism` — Beacon of Mercy
- Prayer · cost I · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield for 1 turn. Then the unit with the least HP on the field, whichever side, heals 40 more.
- applies: shield · ops: heal, apply, if

### `cleave.prism` — Split Beam
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to a random other enemy. The first of them to use a skill afterward is Chilled for 2 turns.
- applies: chilled · inline statuses: split_beam · ops: damage, forEach, apply, removeEffect
  - inline `split_beam` (Debuff; triggers: skillUsed): The first of the two to use a skill is Chilled for 2 turns.

### `shout.prism` — Harsh Light
- Shout · cost W · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- Every ally gains Lens. Every Frostbitten or Sanctified enemy is Condemned for 1 turn.
- applies: condemned · macros: gain_lens · ops: forEach, macro, apply

### `withstand.prism` — Ice Aegis
- Withstand · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 2 turns. When it breaks, they gain Lens, and Immune for 1 turn if they're Anointed.
- applies: immune · inline statuses: ice_aegis, ice_aegis_watch · macros: gain_lens · ops: apply, forEach, macro, if
  - inline `ice_aegis` (Buff): A Shield; when it breaks, the bearer gains Lens.
  - inline `ice_aegis_watch` (Buff; triggers: ownEffectEnded): When the Ice Aegis breaks, the bearer gains Lens (and Immune if Anointed).

### `taunt.prism` — Frozen Gleam
- Taunt · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. Refract: a random ally of theirs is Taunted by the user too.
- applies: taunt · ops: apply, if

### `titan.prism` — Colossus of Light
- Titan · cost Ir · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Armor and Immune. Half of each direct hit on them Refracts away, striking a random enemy instead.
- applies: armor, immune · inline statuses: colossus_of_light · ops: apply, damage
  - inline `colossus_of_light` (Buff; triggers: damaged): Half of each direct hit on the bearer refracts away onto a random enemy.

### `lumen_elk_antler_glow` — Antler Glow (minion skill of `lumen_elk`)
- Minion · cost W · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains Lens.
- macros: gain_lens · ops: forEach, macro

### `lumen_elk_gore` — Gore (minion skill of `lumen_elk`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Sanctified for 1 turn.
- applies: sanctify · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `lumen_elk` — Lumen Elk, 45 HP; skills: lumen_elk_antler_glow, lumen_elk_gore
- `hovering_prism` — Hovering Prism, 10 HP; skills: none

## Named statuses defined here (1) — this group owns their default animations

- `lens` — Lens (Buff): The bearer's next skill doesn't Refract, and its direct damage is 50% stronger. Using a skill spends the Lens. _Applied by skills in: none directly._

## Macros defined here (1) — this group owns their default animations

- `gain_lens`: ops apply; applies lens. _Used by: prism._
