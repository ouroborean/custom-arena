# Slime — animation brief

Group id: `slime`. Element(s): Water + Earth. Concept file: `docs/animations/concepts/slime.yaml`.
Skill source: `packages/content/data/fusions/slime/skills.slime.yaml`; minions: `packages/content/data/fusions/slime/minions.slime.yaml`; statuses: `packages/content/data/fusions/slime/statuses.slime.yaml`; macros: `packages/content/data/fusions/slime/macros.slime.yaml`.

## Skills (33)

### `strike.slime` — Plunging Fist
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they're Engulfed, the user's Oozes heal 10 and the Engulf lasts 1 turn longer.
- ops: damage, if, heal, extendEffects

### `smash.slime` — Splatter
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies. If the target is Stunned, a new Ooze Engulfs them.
- macros: engulf_new · ops: damage, if, set, forEach, macro

### `charge.slime` — Slime Roll
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user creates an Ooze if they have none. For 1 turn, damage aimed at the user hits an allied minion instead.
- inline statuses: slime_roll · macros: make_ooze · ops: damage, if, set, macro, apply
  - inline `slime_roll` (Buff): Damage aimed at the bearer hits an allied minion instead.

### `riposte.slime` — Gel Parry
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; the user creates an Ooze with 10 HP per energy the skill cost (10 to 40). Invisible.
- inline statuses: gel_parry · macros: make_ooze · ops: apply, set, macro
  - inline `gel_parry` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, and the bearer creates an Ooze.

### `rage.slime` — Mitosis
- Rage · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- The user creates an Ooze. For 3 turns, they're Immune and gain 1 Might whenever an allied Ooze Splits (max 3).
- applies: immune, might · inline statuses: mitosis · macros: make_ooze · ops: set, macro, apply, setCounter, if
  - inline `mitosis` (Buff; triggers: signal): Each allied Ooze Split gives 1 Might while this lasts (max 3).

### `shot.slime` — Feeding Glob
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. A random allied Ooze gains 10 max HP (up to 40) and heals 10. If the user has no Ooze, they create a 10 HP one instead.
- macros: make_ooze · ops: damage, if, forEach, addMaxHp, heal, set, macro

### `snipe.slime` — Ooze Mortar
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- Now, the user creates an Ooze. On the following turn, an allied Ooze deals 30 damage to target enemy and Engulfs them, keeping the HP it has left. The target of this skill is invisible. Channeled.
- applies: engulfed · inline statuses: ooze_mortar · macros: make_ooze · ops: set, macro, apply, forEach, damage
  - inline `ooze_mortar` (Neutral): At the end of the following turn, an allied Ooze deals 30 damage to the target and Engulfs them.

### `trap.slime` — Gel Snare
- Trap · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the next healing target enemy receives is undone, and they're Engulfed by a new Ooze with that much HP (max 40). Invisible.
- inline statuses: gel_snare · macros: engulf_new · ops: apply, damage, set, forEach, macro
  - inline `gel_snare` (Debuff, hidden; triggers: healed): The next healing the bearer receives is undone, and a new Ooze with that much HP Engulfs them.

### `maneuver.slime` — Clay Shell
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn, and every 2 stacks of their Renew become 1 Armor for good.
- applies: invulnerable, armor · ops: apply, set, repeat, removeStacks

### `companion.slime` — Great Ooze
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Great Ooze (50 HP) permanently; it doesn't Split. Swallow (r): it Engulfs target enemy, and heals 10 at the end of each turn it holds them.
- summons: great_ooze · ops: summon

### `bolt.slime` — Ooze Lash
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. For 1 turn, the next time they take damage, the user creates an Ooze.
- inline statuses: ooze_lash · macros: make_ooze · ops: damage, apply, set, macro
  - inline `ooze_lash` (Debuff; triggers: damaged): The next time the bearer takes damage, the applier creates an Ooze.

### `blast.slime` — Burst Bubble
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies, and the user creates an Ooze. For 2 turns, whenever an allied Ooze dies, it deals 10 damage to all enemies.
- inline statuses: burst_bubble · macros: make_ooze · ops: damage, set, macro, apply
  - inline `burst_bubble` (Buff): When an allied Ooze dies, it deals 10 damage to all enemies.

### `consume.slime` — Digest
- Consume · cost W · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it, and a new Ooze with 10 HP Engulfs them for 1 turn. If they're already Engulfed, they take 20 Affliction damage instead, healing the user as much.
- applies: engulfed · macros: make_ooze · ops: if, damage, heal, set, forEach, macro, apply

### `summon.slime` — Slime Mother
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Slime Mother (30 HP) for 3 turns; she doesn't Split. Gloop (nc): 10 damage to target enemy. If she lasts all 3 turns, she leaves 2 Oozes.
- summons: slime_mother · ops: summon

### `channel.slime` — Primordial Pool
- Channel · cost Ir · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Now, the user creates an Ooze. For up to 4 turns, at the end of each of the user's turns, 5 damage to all enemies, and each allied Ooze that died since the last turn re-forms with 10 HP. Channeled.
- inline statuses: primordial_pool · macros: make_ooze · ops: set, macro, setCounter, apply, damage, repeat
  - inline `primordial_pool` (Neutral; triggers: signal, turnEnd): Each turn, 5 damage to all enemies, and fallen Oozes re-form with 10 HP.

### `stab.slime` — Oozing Cut
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. For 2 turns, they take 5 Affliction damage at the end of each of the user's turns. Using this again refreshes that effect instead of adding a second one.
- inline statuses: oozing_cut · ops: damage, removeEffect, apply
  - inline `oozing_cut` (Debuff; triggers: turnEnd): 5 Affliction damage at the end of each of the applier's turns.

### `ravage.slime` — Crushing Mass
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. If they're Stunned, the user gains 1 Might and 1 Armor for good.
- applies: might, armor · ops: damage, if, apply

### `mislead.slime` — Gulp
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they're Engulfed by a new Ooze with 10 HP per energy the skill cost. Invisible.
- inline statuses: gulp · macros: engulf_new · ops: apply, set, forEach, macro
  - inline `gulp` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and an Ooze Engulfs them.

### `stun.slime` — Swallow Whole
- Stun · cost Ar · cooldown 4 · target **enemy** · tags Harmful, Strategic
- Creates an Ooze (30 HP) that Engulfs target enemy.
- macros: engulf_new · ops: set, forEach, macro

### `dance.slime` — Slick Shimmy
- Dance · cost AI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and 2 Swiftness, and their Debuffs are removed at the end of each of their turns.
- applies: might, swiftness · inline statuses: slick_shimmy · ops: apply, removeKind
  - inline `slick_shimmy` (Buff; triggers: turnEnd): The bearer's Debuffs are removed at the end of each of their turns.

### `heal.slime` — Irrigate
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. For 3 turns, whenever one of the user's allies is healed, every allied Seedling and Boulder heals as much.
- inline statuses: irrigate · ops: heal, apply
  - inline `irrigate` (Buff; triggers: healed): Healing the bearer receives also heals every allied Seedling and Boulder.

### `bless.slime` — Fertile Silt
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 2 Renew. For 3 turns, each time they're healed, they gain 1 Might (max 2).
- applies: renew, might · inline statuses: fertile_silt · ops: apply, if
  - inline `fertile_silt` (Buff; triggers: healed): Each heal gives 1 Might while this lasts (max 2).

### `curse.slime` — Flypaper
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 2 Confusion for 2 turns. Meanwhile, every unit that uses a skill on them, from either side, gains 1 Confusion for 1 turn.
- applies: confusion · inline statuses: flypaper · ops: apply
  - inline `flypaper` (Debuff; triggers: skillTargeted): Every unit that uses a skill on the bearer gains 1 Confusion.

### `smite.slime` — Settling Silt
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, Stuns on them can't be removed.
- inline statuses: settling_silt · ops: damage, apply
  - inline `settling_silt` (Debuff): Stuns on the bearer can't be removed.

### `prayer.slime` — Gel Mantle
- Prayer · cost Irr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield for 2 turns. Then every allied Ooze dies, and each adds 10 Shield to every ally.
- applies: shield · ops: heal, apply, set, kill, repeat, boostShields

### `cleave.slime` — Clinging Sweep
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and gives them Gel Coat for 2 turns. The first time a direct hit, this one included, leaves them with 10 or more HP, the Gel Coat moves to a random ally of theirs, dealing them 15 damage and lasting 2 turns on them. It moves at most twice.
- applies: gel_coat · ops: apply, damage

### `shout.slime` — Quagmire
- Shout · cost Ir · cooldown 4 · target **allEnemies** · tags Harmful, Strategic
- For 1 turn, all enemies' non-Strategic skills are Stunned. This ends for an enemy when they take damage.
- inline statuses: quagmire · ops: apply, removeSelf
  - inline `quagmire` (Debuff; triggers: damaged): Non-Strategic skills Stunned; ends when the bearer takes damage.

### `withstand.slime` — Quivering Wall
- Withstand · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 40 Shield with no time limit. It loses 10 at the end of each of their turns.
- inline statuses: quivering_wall · ops: apply, if, removeSelf, boostShields
  - inline `quivering_wall` (Buff; triggers: turnEnd): A Shield with no time limit that loses 10 at the end of each of the bearer's turns.

### `taunt.slime` — Sticky Bait
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- The user creates an Ooze (30 HP), and target enemy is Taunted by it for 2 turns. If the Ooze is still alive when the Taunt ends, it Engulfs them.
- applies: taunt, engulfed · inline statuses: sticky_bait · macros: make_ooze · ops: set, macro, apply
  - inline `sticky_bait` (Debuff): If the Ooze is still alive when this ends, it Engulfs the bearer.

### `titan.slime` — Gelatinous Giant
- Titan · cost WW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 4 turns, the user Splits like an Ooze when damaged (the new Oozes are separate minions, max 4) and gains 1 Armor per allied Ooze.
- inline statuses: gelatinous_giant · macros: make_ooze · ops: apply, if, set, macro, damage
  - inline `gelatinous_giant` (Buff; triggers: damaged): Splits off Oozes when damaged; 1 Armor per allied Ooze.

### `ooze_slap` — Slap (minion skill of `ooze`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy.
- ops: damage

### `great_ooze_swallow` — Swallow (minion skill of `great_ooze`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- The Great Ooze Engulfs target enemy.
- applies: engulfed · ops: apply

### `slime_mother_gloop` — Gloop (minion skill of `slime_mother`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `ooze` — Ooze, 20 HP; skills: ooze_slap
  - passive `ooze_split` (triggers: damaged): When it survives damage with 10 or more HP, it Splits into two Oozes sharing its HP.
- `great_ooze` — Great Ooze, 50 HP; skills: great_ooze_swallow
  - passive `great_ooze_feed` (triggers: turnEnd): Heals 10 at the end of each turn it holds an enemy.
- `slime_mother` — Slime Mother, 30 HP; skills: slime_mother_gloop
  - passive `slime_mother_brood` (triggers: turnEnd): If she lasts all 3 turns, she leaves 2 Oozes.

## Named statuses defined here (2) — this group owns their default animations

- `engulfed` — Engulfed (Debuff; triggers: turnEnd): Held by an Ooze: Stunned, and takes 5 Affliction damage at the end of each of its owner's turns, until that Ooze dies or 3 turns pass. _Applied by skills in: slime._
- `gel_coat` — Gel Coat (Debuff; triggers: damaged): The next direct hit that leaves the bearer with 10 or more HP moves this to a random ally of theirs, dealing them 15 damage. It moves at most twice. _Applied by skills in: slime._

## Macros defined here (2) — this group owns their default animations

- `make_ooze`: ops if, summon, addMaxHp, heal. _Used by: slime._
- `engulf_new`: ops macro, apply; applies engulfed. _Used by: slime._
