# Curse — animation brief

Group id: `curse`. Element(s): Unholy + Shadow. Concept file: `docs/animations/concepts/curse.yaml`.
Skill source: `packages/content/data/fusions/curse/skills.curse.yaml`; minions: `packages/content/data/fusions/curse/minions.curse.yaml`; statuses: `packages/content/data/fusions/curse/statuses.curse.yaml`; macros: `packages/content/data/fusions/curse/macros.curse.yaml`.

## Skills (32)

### `strike.curse` — Woeblade
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains a random Hex for 2 turns.
- macros: random_hex · ops: damage, forEach, macro

### `smash.curse` — Crushing Malediction
- Smash · cost SS · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 damage to target enemy, who gains Hex of Pain for 2 turns. While it lasts, each time it deals them damage, their allies take 10 Affliction damage too.
- applies: hex_pain · inline statuses: crushing_malediction · ops: damage, apply, if
  - inline `crushing_malediction` (Debuff; triggers: dealtDamage): Each time the bearer's Hex of Pain deals them damage, their allies take 10 Affliction damage too.

### `charge.curse` — Crossed Path
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user's next Harmful skill gives each enemy it targets a random Hex for 2 turns.
- inline statuses: crossed_path · macros: random_hex · ops: damage, apply, forEach, macro
  - inline `crossed_path` (Buff; triggers: skillUsed): The bearer's next Harmful skill gives each enemy it targets a random Hex.

### `riposte.curse` — Hex Ward
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters every Harmful skill used on the user by a Hexed enemy, and the first one from anyone else. Invisible.
- inline statuses: hex_ward, hex_ward_first · ops: apply
  - inline `hex_ward` (Buff, hidden; triggers: skillTargeted/counter): Counters every Harmful skill a Hexed enemy uses on the bearer.
  - inline `hex_ward_first` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer.

### `rage.curse` — Cursed Hunger
- Rage · cost SA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Lifesteal, and +5 damage (1 Might) for each Hexed enemy, up to 3, counted as they hit.
- applies: lifesteal · inline statuses: cursed_hunger · ops: apply
  - inline `cursed_hunger` (Buff): +5 direct damage per Hexed enemy, up to 3.

### `shot.curse` — Needle of Woe
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy. Each Hex on them lasts 1 turn longer; if they have none, they gain a random Hex for 2 turns.
- macros: random_hex · ops: damage, if, extendEffects, forEach, macro

### `snipe.curse` — Doom
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy; it consumes their Hexes for 15 more each, and those Hexes don't Linger. The target of this skill is invisible. Channeled.
- inline statuses: doom · ops: apply, forEach, set, removeStacks, damage
  - inline `doom` (Neutral): When this runs out, its target takes 40 damage, +15 per Hex consumed.

### `trap.curse` — Cleanser's Snare
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, if the Snare on target enemy is cleansed, they're Stunned for 1 turn and gain Hex of Ruin for 3 turns. Invisible.
- applies: stun, hex_ruin · inline statuses: cleansers_snare, cleansers_snare_watch · ops: apply
  - inline `cleansers_snare` (Debuff, hidden): If this is cleansed, the bearer is Stunned for 1 turn and gains Hex of Ruin for 3 turns.
  - inline `cleansers_snare_watch` (Neutral, hidden; triggers: ownEffectEnded): If the bearer's Cleanser's Snare is cleansed, the enemy it was on is Stunned for 1 turn and gains Hex of Ruin for 3 turns.

### `maneuver.curse` — Wretched Haven
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 2 turns, but bears all three Hexes for 3 turns.
- applies: invulnerable, hex_pain, hex_silence, hex_ruin · ops: apply

### `companion.curse` — Black Cat
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Black Cat (25 HP) permanently. Scratch (r): 10 Piercing damage. Whoever damages the Cat gains a random Hex for 2 turns.
- summons: black_cat · ops: summon

### `bolt.curse` — Malediction
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy, who gains Hex of Ruin for 2 turns; each Buff they already have counts as gained, for 10 Affliction each.
- applies: hex_ruin · ops: damage, apply, if

### `blast.curse` — Soul Eclipse
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Each Hexed one is Blinded for 1 turn; each other one gains a random Hex for 2 turns.
- applies: blinded · macros: random_hex · ops: damage, forEach, if, apply, macro

### `consume.curse` — Feed on Misery
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. Each Hex on them is shortened by 1 turn, and the user heals 10 more per Hex shortened.
- ops: damage, set, extendEffects, heal

### `summon.curse` — Hex Shade
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Hex Shade (15 HP) for 3 turns. Whisper (r): target enemy gains a random Hex for 2 turns.
- summons: hex_shade · ops: summon

### `channel.curse` — Litany of Curses
- Channel · cost Ar · cooldown 3 · target **allEnemies** · tags Harmful, Strategic, Channeled
- For 3 turns, at the end of each of the user's turns, a random enemy gains a random Hex for 2 turns; if they already had it, they take 20 Affliction instead. Channeled.
- applies: hex_pain, hex_silence, hex_ruin · inline statuses: litany_of_curses · ops: apply, forEach, random, if, damage
  - inline `litany_of_curses` (Neutral; triggers: turnEnd): Each turn, a random enemy gains a random Hex, or takes 20 Affliction if they had it.

### `stab.curse` — Cursed Dagger
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the user is Hexed, a random one of their Hexes moves onto the target, and the hit deals 25 instead.
- macros: curse_pass_hex · ops: if, macro, damage

### `ravage.curse` — Rend the Wards
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Target enemy loses a random Buff, or gains Hex of Ruin for 2 turns if they have none. Then deals 30 Piercing damage to them.
- applies: hex_ruin · ops: if, removeRandom, apply, damage

### `mislead.curse` — Tongue-Tied
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and their Hexes last 1 turn longer. The user becomes Untargetable for 1 turn. Invisible.
- applies: untargetable · inline statuses: tongue_tied · ops: apply, extendEffects
  - inline `tongue_tied` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and their Hexes last 1 turn longer.

### `stun.curse` — Evil Eye
- Stun · cost A · cooldown 4 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn. When it ends, the Stun passes to a random enemy who hasn't had it, until every enemy has been Stunned once.
- applies: stun, evil_eye · ops: setCounter, apply

### `dance.curse` — Envious Jig
- Dance · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 1 Swiftness. For 3 turns, whenever an enemy gains a Buff, the user gains a copy, and the enemy's lasts 1 turn less.
- applies: swiftness · inline statuses: envious_jig · ops: apply, copyEventEffect, eventEffect
  - inline `envious_jig` (Debuff; triggers: effectGained): Each Buff the bearer gains is copied to the applier and lasts 1 turn less.

### `heal.curse` — Pass the Curse
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20, and their Hexes and other Debuffs move to a random enemy.
- ops: heal, moveEffects

### `bless.curse` — Unhallowed Pact
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 2 Might and Lifesteal, but they're Isolated for as long.
- applies: might, lifesteal, isolated · ops: apply

### `curse.curse` — Bane
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains all three Hexes for 2 turns.
- applies: hex_pain, hex_silence, hex_ruin · ops: apply

### `smite.curse` — Blind Man's Toll
- Smite · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Blinds them for 1 turn. For 2 turns, each skill they use while Blinded lets the user drain a Soul Fragment from them.
- applies: blinded · inline statuses: blind_mans_toll · macros: drain_it · ops: damage, apply, if, forEach, macro
  - inline `blind_mans_toll` (Debuff; triggers: skillUsed): Each skill the bearer uses while Blinded lets the applier drain a Soul Fragment from them.

### `prayer.curse` — Vespers of Slumber
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. For 2 turns, the first hit that would kill each of them leaves them at 1 HP and Asleep for 1 turn instead.
- applies: sleep · inline statuses: vespers_of_slumber · ops: heal, apply, if, removeSelf
  - inline `vespers_of_slumber` (Buff; triggers: damaged): The first hit that would kill the bearer leaves them at 1 HP and Asleep for 1 turn.

### `cleave.curse` — Grudging Cut
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Then whichever other enemy has the most HP takes Affliction damage equal to half the HP they have over the target (at least 5, at most 25).
- ops: damage, set, forEach, if

### `shout.curse` — Ill Wind
- Shout · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies gain Hex of Silence for 2 turns. The first Strategic skill each of them uses meanwhile leaves them Intimidated for 2 turns.
- applies: hex_silence, intimidated · inline statuses: ill_wind · ops: apply
  - inline `ill_wind` (Debuff; triggers: skillUsed): The first Strategic skill the bearer uses leaves them Intimidated for 2 turns.

### `withstand.curse` — Shrouded Ward
- Withstand · cost A · cooldown 2 · target **self** · tags Helpful, Strategic, Stealthy
- The user gains 20 Shield for 1 turn. Each enemy who damages it is Blinded for 1 turn. Stealthy.
- applies: blinded · inline statuses: shrouded_ward, shrouded_ward_eyes · ops: apply, if, removeSelf
  - inline `shrouded_ward` (Buff): Absorbs damage.
  - inline `shrouded_ward_eyes` (Buff; triggers: damaged): Each enemy who damages the bearer's Shrouded Ward is Blinded for 1 turn.

### `taunt.curse` — Geas
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy gains a random Hex for 2 turns. Then every Hexed enemy is Taunted by the user for 1 turn.
- applies: taunt · macros: random_hex · ops: forEach, macro, apply

### `titan.curse` — The Accursed
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune, and every enemy gains a random Hex for 2 turns. Meanwhile, each time an enemy hits the user, they take 10 Affliction damage per Hex they bear.
- applies: immune · inline statuses: the_accursed · macros: random_hex · ops: apply, forEach, macro, damage
  - inline `the_accursed` (Buff; triggers: damaged): Each enemy who hits the bearer takes 10 Affliction per Hex they bear.

### `cat_scratch` — Scratch (minion skill of `black_cat`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy.
- ops: damage

### `shade_whisper` — Whisper (minion skill of `hex_shade`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy gains a random Hex for 2 turns.
- macros: random_hex · ops: forEach, macro

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `black_cat` — Black Cat, 25 HP; skills: cat_scratch
- `hex_shade` — Hex Shade, 15 HP; skills: shade_whisper

## Named statuses defined here (5) — this group owns their default animations

- `hex_pain` — Hex of Pain (Debuff; triggers: dealtDamage): Whenever the bearer deals direct damage, they take 10 Affliction. Lingers. _Applied by skills in: curse._
- `hex_silence` — Hex of Silence (Debuff): The bearer's Strategic skills cost 1 more random energy. Lingers. _Applied by skills in: curse._
- `hex_ruin` — Hex of Ruin (Debuff; triggers: effectGained): Whenever the bearer gains a Buff, they take 10 Affliction. Lingers. _Applied by skills in: curse._
- `cat_curse` — Bad Luck (Neutral; triggers: damaged): Whoever damages the Cat gains a random Hex for 2 turns. _Applied by skills in: none directly._
- `evil_eye` — Evil Eye (Debuff): When this ends, the Stun passes to an ally of the bearer who hasn't been Stunned by it. _Applied by skills in: curse._

## Macros defined here (2) — this group owns their default animations

- `random_hex`: ops random, apply; applies hex_pain, hex_silence, hex_ruin. _Used by: curse._
- `curse_pass_hex`: ops random, if, moveEffects. _Used by: curse._
