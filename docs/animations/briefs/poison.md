# Poison — animation brief

Group id: `poison`. Element(s): Poison. Concept file: `docs/animations/concepts/poison.yaml`.
Skill source: `packages/content/data/poison/skills.poison.yaml`; minions: `packages/content/data/poison/minions.poison.yaml`; statuses: `packages/content/data/poison/statuses.poison.yaml`.

## Skills (33)

### `strike.poison` — Viper Strike
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and gives them 1 Toxin.
- applies: toxin · ops: damage, apply

### `smash.poison` — Plague Stomp
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and gives their allies 1 Toxin.
- applies: toxin · ops: damage, apply

### `charge.poison` — Lunge
- Charge · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. Through the user's next turn, all enemies are considered Prey.
- applies: prey · ops: damage, apply

### `riposte.poison` — Shed Skin
- Riposte · cost W · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, if the user receives direct damage, they heal 15 HP and gain 3 Renew. Invisible.
- applies: renew · inline statuses: shed_skin · ops: apply, heal
  - inline `shed_skin` (Buff, hidden; triggers: damaged): The next time the bearer takes direct damage, they heal 15 and gain 3 Renew.

### `rage.poison` — Viper Stance
- Rage · cost S · cooldown 2 · target **none** · tags Harmful, Strategic
- All stacks of Might in the battle turn into stacks of Weakness.
- ops: convertEffects

### `shot.poison` — Sting
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy and gives them 1 Toxin, 1 Weakness, or 1 Vulnerable, chosen at random.
- applies: toxin, weakness, vulnerable · ops: damage, random, apply

### `snipe.poison` — Banewood Javelin
- Snipe · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget, Uncounterable
- The user deals 25 Affliction damage to target enemy on the following turn. The target of this skill is invisible. Channeled. Uncounterable.
- inline statuses: banewood_javelin · ops: apply, damage
  - inline `banewood_javelin` (Neutral): Fires at the end of the following turn unless the user is stunned, dies or uses another skill.

### `trap.poison` — Snake Pit
- Trap · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, if target enemy uses a Strategic skill, they gain 1 Toxin. Invisible.
- applies: toxin · inline statuses: snake_pit · ops: apply
  - inline `snake_pit` (Debuff, hidden; triggers: skillUsed): Each Strategic skill the bearer uses gives them 1 Toxin.

### `maneuver.poison` — Slither
- Maneuver · cost W · cooldown 2 · target **self** · tags Helpful, Strategic, Unstunnable
- The user becomes Invulnerable for 1 turn and gains Focus. Unstunnable.
- applies: invulnerable, focus · ops: apply

### `companion.poison` — Emerald Asp
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Emerald Asp minion (25 HP). Serpent Fang: 5 Piercing damage and 1 Toxin. Constrict: 2 Weakness and 2 Vulnerable for 2 turns.
- summons: emerald_asp · ops: summon

### `bolt.poison` — Acid Orb
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the target is Prey, they are Marked and gain 1 Vulnerable.
- applies: mark, vulnerable · ops: damage, if, apply

### `blast.poison` — Acid Wash
- Blast · cost Wr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies and gives them all 1 Vulnerable for 2 turns.
- applies: vulnerable · ops: damage, apply

### `consume.poison` — Devour
- Consume · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Executes target enemy with less than 15 HP. This range is doubled for minions.
- ops: if, kill

### `summon.poison` — Spriggan Harasser
- Summon · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons a Spriggan Harasser minion (15 HP) for 3 turns. Its Sting (W) uses Sting on target enemy.
- summons: spriggan_harasser · ops: summon

### `channel.poison` — Nine Plagues
- Channel · cost Wrr · cooldown 9 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Deals 5 Affliction damage to all enemies for 9 turns. Each turn this skill is channeled, a random enemy receives 1 Toxin. Channeled.
- applies: toxin · inline statuses: nine_plagues · ops: apply, damage
  - inline `nine_plagues` (Neutral; triggers: turnEnd): At the end of each of the user's turns, 5 Affliction damage to all enemies and 1 Toxin to a random enemy.

### `stab.poison` — Pounce
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy. If that enemy is Prey, the user generates a random energy; otherwise, it gives them 1 Toxin.
- applies: toxin · ops: damage, if, gainEnergy, signal, apply

### `ravage.poison` — Envenom
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Bypass
- Deals 25 Piercing damage to target enemy, Bypassing Invulnerability. If used against Prey or Invulnerable targets, applies 2 Toxin.
- applies: toxin · ops: set, damage, if, apply

### `mislead.poison` — Numbing Needle
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, they will be countered and will gain 1 Toxin, 1 Weakness, and 1 Vulnerable. Invisible.
- applies: toxin, weakness, vulnerable · inline statuses: numbing_needle · ops: apply
  - inline `numbing_needle` (Debuff, hidden; triggers: skillUsed/counter): The bearer's Harmful skills are countered; each counter gives them 1 Toxin, 1 Weakness and 1 Vulnerable.

### `stun.poison` — Lacerate
- Stun · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn. If they are Prey, they are Stunned for 2 turns instead.
- applies: stun · ops: if, apply

### `dance.poison` — Cobra Stance
- Dance · cost A · cooldown 2 · target **none** · tags Harmful, Strategic
- All stacks of Armor in the battle turn into stacks of Vulnerable.
- ops: convertEffects

### `heal.poison` — Moonglove Mixture
- Heal · cost W · cooldown 1 · target **any** · tags Helpful, Strategic
- Target unit (ally or enemy) is healed for 30 HP and gains 2 Toxin.
- applies: toxin · ops: heal, apply

### `bless.poison` — Viper's Crest
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Gives target ally 1 Might and 1 Swiftness for 3 turns.
- applies: might, swiftness · ops: apply

### `curse.poison` — Swamp Toxins
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Confusion and 1 Toxin.
- applies: confusion, toxin · ops: apply

### `smite.poison` — Preymark
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 1 turn, if an ally damages them, they receive 1 Vulnerable.
- applies: vulnerable · inline statuses: preymark · ops: damage, apply
  - inline `preymark` (Debuff; triggers: damaged): Each time the applier's side deals direct damage to the bearer, they gain 1 Vulnerable.

### `prayer.poison` — Serpentsong
- Prayer · cost Wr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies gain 2 Renew and all enemies gain 1 Toxin.
- applies: renew, toxin · ops: apply

### `cleave.poison` — Tail Lash
- Cleave · cost S · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies. If this strikes any Prey, its cooldown is reset.
- ops: damage, if, resetCooldown

### `shout.poison` — Bad Stomach
- Shout · cost r · cooldown 1 · target **none** · tags Harmful, Strategic
- If the user has no Toxin, this skill gives them 1 Toxin. Otherwise, it gives all enemies 1 Toxin.
- applies: toxin · ops: if, apply

### `withstand.poison` — Coil
- Withstand · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 5 Shield and 1 Armor.
- applies: shield, armor · ops: apply

### `taunt.poison` — Mesmerizing Glare
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted and is considered Prey for 3 turns.
- applies: taunt, prey · ops: apply

### `titan.poison` — Constrictor Stance
- Titan · cost W · cooldown 2 · target **none** · tags Harmful, Strategic
- All stacks of Focus in the battle turn into stacks of Confusion.
- ops: convertEffects

### `asp_fang` — Serpent Fang (minion skill of `emerald_asp`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Target enemy receives 5 Piercing damage and 1 Toxin.
- applies: toxin · ops: damage, apply

### `asp_constrict` — Constrict (minion skill of `emerald_asp`)
- Minion · cost rr · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy receives 2 Weakness and 2 Vulnerable for 2 turns.
- applies: weakness, vulnerable · ops: apply

### `spriggan_sting` — Sting (minion skill of `spriggan_harasser`)
- Minion · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy and gives them 1 Toxin, 1 Weakness, or 1 Vulnerable, chosen at random.
- applies: toxin, weakness, vulnerable · ops: damage, random, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `emerald_asp` — Emerald Asp, 25 HP; skills: asp_fang, asp_constrict
- `spriggan_harasser` — Spriggan Harasser, 15 HP; skills: spriggan_sting

## Named statuses defined here (2) — this group owns their default animations

- `toxin` — Toxin (Debuff; triggers: turnEnd): Takes 5 Affliction damage per stack at the end of the applier's turn. Stacks. _Applied by skills in: antidote, assassin, battery, blight, devil, evolution, faerie, serum, stasis, poison._
- `prey` — Prey (marked) (Debuff): This unit is considered Prey. _Applied by skills in: antidote, evolution, poison._
