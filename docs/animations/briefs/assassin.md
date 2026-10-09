# Assassin — animation brief

Group id: `assassin`. Element(s): Poison + Shadow. Concept file: `docs/animations/concepts/assassin.yaml`.
Skill source: `packages/content/data/fusions/assassin/skills.assassin.yaml`; minions: `packages/content/data/fusions/assassin/minions.assassin.yaml`; statuses: `packages/content/data/fusions/assassin/statuses.assassin.yaml`; macros: `packages/content/data/fusions/assassin/macros.assassin.yaml`.

## Skills (33)

### `strike.assassin` — Throatcut
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If this executes your Death Mark, a new one goes on a random enemy, hidden.
- macros: mark_if_none · ops: set, damage, if, macro

### `smash.assassin` — Coordinated Strike
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 20 damage to target enemy and 10 to their allies. Each enemy hit gains 1 Toxin per Stealthed ally of the user. Stealthy.
- applies: toxin · ops: set, damage, apply

### `charge.assassin` — Stalk
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 15 damage to target enemy, who gains your Death Mark for 2 turns. Stealthy.
- applies: death_mark · ops: damage, removeEffect, apply

### `riposte.assassin` — Garrote Wire
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user is Stunned for 1 turn, or 2 if the countered skill has a cooldown of 3 or more. Invisible.
- applies: stun · inline statuses: garrote_wire · ops: apply
  - inline `garrote_wire` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer and Stuns its user.

### `rage.assassin` — Open Contract
- Rage · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic, Stealthy
- A random enemy gains your Death Mark if none has it. For 3 turns, the user gains 1 Might, and at the end of each of their turns the Mark's threshold rises by 5 (max 40), going to a random enemy first if none has it. Stealthy.
- applies: might · inline statuses: open_contract · macros: mark_if_none · ops: macro, apply, growShield
  - inline `open_contract` (Buff; triggers: turnEnd): At the end of each of the bearer's turns, your Death Mark's threshold rises by 5 (max 40).

### `shot.assassin` — Blowdart
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy. A hidden effect deals them 15 Affliction damage at the end of their next turn.
- inline statuses: blowdart · ops: damage, apply
  - inline `blowdart` (Debuff, hidden): When this ends, the bearer takes 15 Affliction damage.

### `snipe.assassin` — The Long Shot
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy. If they have your Death Mark, this executes at 40 HP; if not, they gain it. The target of this skill is invisible. Channeled.
- inline statuses: the_long_shot · macros: place_mark · ops: apply, forEach, set, damage, if, kill, macro
  - inline `the_long_shot` (Neutral): When this runs out, its target takes 40 damage.

### `trap.assassin` — Tainted Well
- Trap · cost I · cooldown 3 · target **allEnemies** · tags Harmful, Strategic, Invisible
- For 3 turns, all enemies take 5 Affliction damage whenever they use any skill. Invisible.
- inline statuses: tainted_well · ops: apply, damage
  - inline `tainted_well` (Debuff, hidden; triggers: skillUsed): Each skill the bearer uses deals them 5 Affliction damage.

### `maneuver.assassin` — Covering Smoke
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn, and their other ally with the least HP gains Stealth for as long. Meanwhile, Stealthed allies stay Stealthed whatever skills they use.
- applies: invulnerable, stealth · inline statuses: covering_smoke · ops: apply
  - inline `covering_smoke` (Buff): The bearer's skills are Stealthy.

### `companion.assassin` — Shadow Viper
- Companion · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Shadow Viper (25 HP) permanently. Venom Fang (r): 5 Piercing damage and 1 Toxin. Seek the Mark (rr): 15 Piercing damage to your Death Mark's bearer; if none has it, target enemy gains it.
- summons: shadow_viper · ops: summon

### `bolt.assassin` — Whispered Names
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Marks them for 2 turns. When the Mark is spent, a random other enemy is Marked for 1 turn, up to 3 times.
- applies: mark, whispered_names · ops: damage, apply

### `blast.assassin` — Poison Smoke
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, who gain 1 Toxin each. Then your Death Mark, if it's out, moves (hidden) to the enemy with the least HP.
- applies: toxin · macros: place_mark · ops: damage, apply, if, forEach, macro

### `consume.assassin` — Bloodletting
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, who gains 2 Toxin. For 2 turns, at the end of each of the user's turns, the user heals 5 per Toxin on them.
- applies: toxin · inline statuses: bloodletting · ops: damage, apply, heal
  - inline `bloodletting` (Debuff; triggers: turnEnd): At the end of each of the applier's turns, they heal 5 per Toxin on the bearer.

### `summon.assassin` — Hired Blade
- Summon · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Hired Blade (20 HP) for 3 turns. Shank (r): 10 Affliction damage. Whoever kills the Blade gains your Death Mark.
- summons: hired_blade · ops: summon

### `channel.assassin` — Open Season
- Channel · cost Ar · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, a random enemy gains your Death Mark if none has one, and at the end of each of the user's turns all enemies take 10 damage; meanwhile your Death Mark executes at 35 HP. Channeled.
- inline statuses: open_season · macros: mark_if_none · ops: macro, apply, damage
  - inline `open_season` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies; the Death Mark executes at 35 HP.

### `stab.assassin` — Stiletto
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. Against your Death Mark, the Mark's execute threshold rises by 5 for good (max 40).
- ops: if, growShield, damage

### `ravage.assassin` — Unseen Knife
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. Against a Blinded or Sleeping target, the user gains Stealth for 1 turn.
- applies: stealth · ops: set, damage, if, apply

### `mislead.assassin` — Poisoned Lure
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they gain your Death Mark; if they don't, they gain 2 Toxin. Invisible.
- applies: toxin · inline statuses: poisoned_lure · macros: place_mark · ops: apply, forEach, macro
  - inline `poisoned_lure` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered and Death-Marks them; if unused, they gain 2 Toxin.

### `stun.assassin` — Knockout Poison
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Target enemy gains 2 Toxin, then loses all their Toxin, takes 10 Affliction damage per stack lost (at most 30), and is Stunned for 1 turn.
- applies: toxin, stun · ops: apply, set, removeEffect, damage

### `dance.assassin` — Dance of Knives
- Dance · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus, and each skill they use also deals 5 Piercing damage to your Death Mark's bearer.
- applies: swiftness, focus · inline statuses: dance_of_knives · ops: apply, damage
  - inline `dance_of_knives` (Buff; triggers: skillResolved): Each skill the bearer uses deals 5 Piercing damage to the Death Mark's bearer.

### `heal.assassin` — Blood Debt
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. The next time the enemy who damaged them most recently takes a direct hit from the user's side within 2 turns, the ally heals 20 more.
- inline statuses: blood_debt · ops: heal, apply
  - inline `blood_debt` (Debuff; triggers: damaged): The next direct hit the bearer takes from the applier's side heals the one they hurt 20.

### `bless.assassin` — Subcontract
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might, and their skills count as Assassin skills against your Death Mark.
- applies: might, subcontract · ops: apply

### `curse.assassin` — Mark for Death
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains your Death Mark for 3 turns and is Confused for 2. The Mark executes 5 HP higher per Toxin on them when it's placed (max 40).
- applies: death_mark, confusion · ops: set, removeEffect, apply

### `smite.assassin` — Souring Mark
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each ally who damages them turns 1 of their Buffs into 1 Vulnerable.
- applies: vulnerable · inline statuses: souring_mark · ops: damage, apply, if, removeRandom
  - inline `souring_mark` (Debuff; triggers: damaged): Each direct hit from the applier's side turns 1 of the bearer's Buffs into 1 Vulnerable.

### `prayer.assassin` — Serpent's Communion
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. For 2 turns, Toxin on the user's allies heals them instead of harming them.
- applies: hormesis · ops: heal, apply

### `cleave.assassin` — Fan of Knives
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 20 damage to target enemy and 10 to a random other enemy, who is always your Death Mark's bearer if it's out. Stealthy.
- ops: damage, if

### `shout.assassin` — Pick the Target
- Shout · cost Wr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Isolated for 1 turn, and the one with the least HP gains your Death Mark.
- applies: isolated · macros: place_mark · ops: apply, forEach, macro

### `withstand.assassin` — Hidden Mail
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, direct hits on the user deal half damage, and the first enemy to hit them gains your Death Mark. Invisible.
- inline statuses: hidden_mail · macros: place_mark · ops: apply, if, setFlag, forEach, macro
  - inline `hidden_mail` (Buff, hidden; triggers: damaged): Direct hits on the bearer deal half damage; the first enemy to land one gains the Death Mark.

### `taunt.assassin` — Whisper from the Dark
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Stealthy
- Target enemy is Taunted by the user for 1 turn, even while the user is Stealthed and can't be targeted. Stealthy.
- applies: taunt · ops: apply

### `titan.assassin` — Guildmaster
- Titan · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Armor and Ghosted, and every enemy gains a Death Mark from them for as long.
- applies: armor, ghosted, death_mark · ops: apply

### `viper_venom_fang` — Venom Fang (minion skill of `shadow_viper`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, who gains 1 Toxin.
- applies: toxin · ops: damage, apply

### `viper_seek_the_mark` — Seek the Mark (minion skill of `shadow_viper`)
- Minion · cost rr · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 Piercing damage to your Death Mark's bearer; if none has it, target enemy gains it.
- applies: death_mark · ops: if, damage, apply

### `blade_shank` — Shank (minion skill of `hired_blade`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `shadow_viper` — Shadow Viper, 25 HP; skills: viper_venom_fang, viper_seek_the_mark
- `hired_blade` — Hired Blade, 20 HP; skills: blade_shank

## Named statuses defined here (3) — this group owns their default animations

- `death_mark` — Death Mark (Debuff; triggers: damaged): Assassin skills from the marker's side deal the bearer 10 more, and one that leaves them at or below the Mark's threshold (25 HP) executes them. _Applied by skills in: assassin._
- `subcontract` — Subcontract (Buff): The bearer's skills count as Assassin skills against Death Marks. _Applied by skills in: assassin._
- `whispered_names` — Whispered Names (Debuff; triggers: damaged): When the bearer's Mark is spent, a random other enemy is Marked for 1 turn and gains this effect (up to 3 times in all). _Applied by skills in: assassin._

## Macros defined here (2) — this group owns their default animations

- `place_mark`: ops removeEffect, apply; applies death_mark. _Used by: assassin._
- `mark_if_none`: ops if, forEach, macro. _Used by: assassin._
