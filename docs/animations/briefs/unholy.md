# Unholy — animation brief

Group id: `unholy`. Element(s): Unholy. Concept file: `docs/animations/concepts/unholy.yaml`.
Skill source: `packages/content/data/unholy/skills.unholy.yaml`; minions: `packages/content/data/unholy/minions.unholy.yaml`; statuses: `packages/content/data/unholy/statuses.unholy.yaml`; macros: `packages/content/data/unholy/macros.unholy.yaml`.

## Skills (33)

### `strike.unholy` — Witchblade
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If the enemy is Horrified, this skill deals 10 additional damage.
- ops: damage

### `smash.unholy` — Soulcrusher
- Smash · cost SS · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 40 damage to target enemy and Horrifies their allies for 2 turns.
- applies: horrified · ops: damage, apply

### `charge.unholy` — Wraithwalk
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user's next Harmful skill drains a Soul Fragment from its target.
- applies: soul_fragment · inline statuses: wraithwalk · ops: damage, apply
  - inline `wraithwalk` (Buff; triggers: skillResolved): The bearer's next Harmful skill drains a Soul Fragment.

### `riposte.unholy` — Spiteful Retort
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user will counter any Harmful skill used on them, Horrifying its user for 2 turns. Invisible.
- applies: horrified · inline statuses: spiteful_retort · ops: apply
  - inline `spiteful_retort` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer and Horrifies their users for 2 turns.

### `rage.unholy` — Undying Fury
- Rage · cost Sr · cooldown 4 · target **self** · tags Harmful, NonStrategic
- Deals 10 damage to a random enemy, and again for every 25 health the user is missing. Then the user becomes Immortal for 2 turns.
- applies: immortal · ops: set, repeat, damage, apply

### `shot.unholy` — Bone Shard
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, increased by 5 for each Soul Fragment the user has.
- ops: damage

### `snipe.unholy` — Soul Lance
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user deals 40 damage to target enemy on the following turn. If the target is below 50 health afterwards, the user drains a Soul Fragment from them. The target of this skill is invisible. Channeled.
- applies: soul_fragment · inline statuses: soul_lance · ops: apply, damage, if
  - inline `soul_lance` (Neutral): Fires at the end of the following turn unless the user is stunned, dies or uses another skill.

### `trap.unholy` — Soul Shackle
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a skill, they are Stunned for 1 turn and gain 2 Weakness for 2 turns. Invisible.
- applies: stun, weakness · inline statuses: soul_shackle · ops: apply
  - inline `soul_shackle` (Debuff, hidden; triggers: skillUsed): When the bearer uses a skill, they are Stunned for 1 turn and gain 2 Weakness for 2 turns.

### `maneuver.unholy` — Grave Step
- Maneuver · cost A · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- The user becomes Immortal for 1 turn. This effect is Invisible.
- inline statuses: grave_step · ops: apply
  - inline `grave_step` (Buff, hidden): Immortal (Health can't fall below 5).

### `companion.unholy` — Hellhound
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Hellhound minion (35 HP). Jaws of Hell (S): 10 Affliction damage to target enemy each turn. Channeled.
- summons: hellhound · ops: summon

### `bolt.unholy` — Fel Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and Horrifies them for 2 turns.
- applies: horrified · ops: damage, apply

### `blast.unholy` — Soul Blast
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies, increased by 10 for each Soul Fragment the user has.
- ops: damage

### `consume.unholy` — Drain Soul
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, draining a Soul Fragment from them. If the target is Horrified, the user gains an additional Soul Fragment.
- applies: soul_fragment · ops: set, damage, apply

### `summon.unholy` — Imp
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Imp minion (25 HP). Firebolt (r): 10 Affliction damage to target enemy. Gleeful Torment (I): target enemy is Horrified for 1 turn.
- summons: imp · ops: summon

### `channel.unholy` — Drain Life
- Channel · cost rr · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled
- Each turn, deals 10 damage to target enemy and heals the user for 10 Health. If the target dies while affected by this skill, the user gains a Soul Fragment. Channeled.
- applies: soul_fragment · inline statuses: drain_life, drained · ops: apply, damage, heal, if
  - inline `drain_life` (Neutral; triggers: turnEnd): Each end of the user's turn, 10 damage to the target and 10 healing to the user. Lasts until interrupted.
  - inline `drained` (Debuff; triggers: damaged): If the bearer dies while drained, the drainer gains a Soul Fragment.

### `stab.unholy` — Blighted Dagger
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the target is at or above 70 health, drains a Soul Fragment from them.
- applies: soul_fragment · ops: set, damage, if, apply, signal

### `ravage.unholy` — Lay Waste
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 Piercing damage to target enemy. If the target has any Buffs, they are Horrified for 1 turn.
- applies: horrified · ops: damage, if, apply

### `mislead.unholy` — Mirage of Nightmares
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Strategic skill, it is countered, and the user becomes Untargetable for 1 turn and gains 1 Might and 1 Swiftness. Invisible.
- inline statuses: mirage_of_nightmares · macros: mirage_reward · ops: apply, macro
  - inline `mirage_of_nightmares` (Debuff, hidden; triggers: skillUsed/counter, skillUsed/counter): The bearer's Strategic skills are countered; each counter makes the caster Untargetable for 1 turn and gives them 1 Might and 1 Swiftness.

### `stun.unholy` — Cripple
- Stun · cost SA · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 permanent Vulnerable. If they are Horrified, they also gain 1 permanent Weakness.
- applies: vulnerable, weakness · ops: apply, if

### `dance.unholy` — Grisly Spectacle
- Dance · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 Piercing damage to target enemy and extends all active Horrify effects by 1 turn. The user gains 1 Confusion for 1 turn (stacking).
- applies: confusion · ops: damage, extendEffects, apply

### `heal.unholy` — Consume Lesser
- Heal · cost r · cooldown 0 · target **ally** · tags Helpful, NonStrategic
- Deals 15 damage to another ally and heals the user for 20 health.
- ops: damage, heal

### `bless.unholy` — Vampirism
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Lifesteal for 2 turns.
- applies: lifesteal · ops: apply

### `curse.unholy` — Cause Fear
- Curse · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Horrified until the end of the turn.
- applies: horrified · ops: apply

### `smite.unholy` — Soul Sickness
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, any ally that damages them gains a Soul Fragment.
- applies: soul_fragment · inline statuses: soul_sickness · ops: damage, apply
  - inline `soul_sickness` (Debuff; triggers: damaged): Units on the applier's side that damage the bearer gain a Soul Fragment.

### `prayer.unholy` — Profane Chant
- Prayer · cost Wrr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies and applies 2 Weakness to each of them for 1 turn.
- applies: weakness · ops: damage, apply

### `cleave.unholy` — Oathbreaker Strike
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, then 10 damage to that target and to each of the user's allies.
- ops: damage, forEach, if

### `shout.unholy` — Soulshriek
- Shout · cost S · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the user has a Soul Fragment, consumes one to deal 10 additional damage and Horrify the target for 2 turns.
- applies: horrified · ops: set, removeStacks, damage, if, apply

### `withstand.unholy` — Misery
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user drains 10 Health from each other ally, gaining 20 Shield plus the total amount drained.
- applies: shield · ops: set, forEach, if, damage, apply

### `taunt.unholy` — Unrelenting Horror
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted for 2 turns. If the target is Horrified, the user also gains Lifesteal for that time.
- applies: taunt, lifesteal · ops: apply, if

### `titan.unholy` — Soul Colossus
- Titan · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 2 turns, the user gains 2 Armor and Immortal, and the first time an enemy damages them each turn, they gain a Soul Fragment.
- applies: armor, immortal, soul_fragment · inline statuses: soul_colossus · ops: apply, if, setCounter
  - inline `soul_colossus` (Buff; triggers: damaged): The first time an enemy damages the bearer each turn, they gain a Soul Fragment.

### `hellhound_jaws` — Jaws of Hell (minion skill of `hellhound`)
- Minion · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic, Channeled
- Deals 10 Affliction damage to target enemy at the end of each of the Hellhound's turns. Channeled.
- inline statuses: jaws_of_hell · ops: apply, damage
  - inline `jaws_of_hell` (Neutral; triggers: turnEnd): Each end of the Hellhound's turn, 10 Affliction damage to the target. Lasts until interrupted.

### `imp_firebolt` — Firebolt (minion skill of `imp`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to target enemy.
- ops: damage

### `imp_gleeful_torment` — Gleeful Torment (minion skill of `imp`)
- Minion · cost I · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Horrified for 1 turn.
- applies: horrified · ops: apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `hellhound` — Hellhound, 35 HP; skills: hellhound_jaws
- `imp` — Imp, 25 HP; skills: imp_firebolt, imp_gleeful_torment

## Named statuses defined here (4) — this group owns their default animations

- `horrified` — Horrified (Debuff): Can't gain Buffs. _Applied by skills in: blight, devil, evil, ghost, lich, reanimation, unholy._
- `immortal` — Immortal (Buff): Health can't fall below 5. _Applied by skills in: blight, blood, devil, evil, grave, lich, reanimation, unholy._
- `soul_fragment` — Soul Fragment (Buff): +5 direct damage dealt per stack (1 Might each). Permanent until consumed. _Applied by skills in: blight, blood, devil, evil, ghost, grave, lich, reanimation, zealot, unholy._
- `lifesteal` — Lifesteal (Buff): Heals for the Health it removes from other characters. _Applied by skills in: blood, curse, devil, evil, reanimation, unholy._

## Macros defined here (1) — this group owns their default animations

- `mirage_reward`: ops apply; applies untargetable, might, swiftness. _Used by: unholy._
