# Thunder — animation brief

Group id: `thunder`. Element(s): Lightning + Lightning. Concept file: `docs/animations/concepts/thunder.yaml`.
Skill source: `packages/content/data/fusions/thunder/skills.thunder.yaml`; minions: `packages/content/data/fusions/thunder/minions.thunder.yaml`; statuses: `packages/content/data/fusions/thunder/statuses.thunder.yaml`; macros: `packages/content/data/fusions/thunder/macros.thunder.yaml`.

## Skills (31)

### `strike.thunder` — Clap
- Strike · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. It Resounds twice, at the start of each of the user's next 2 turns.
- applies: resound_echo · macros: resound_it · ops: forEach, damage, macro, apply

### `smash.thunder` — Rolling Thunder
- Smash · cost SI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. Resound, and the echo also hits each of their allies.
- applies: resound_echo_wide · ops: forEach, damage, apply

### `charge.thunder` — Sonic Boom
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who is Deafened until the end of the user's next turn. The next time the user uses a skill, by the end of their next turn, every Deafened enemy takes 10 damage.
- applies: deafened · inline statuses: sonic_boom · ops: damage, apply
  - inline `sonic_boom` (Buff; triggers: skillUsed): When the bearer next uses a skill, every Deafened enemy takes 10 damage.

### `riposte.thunder` — Answering Peal
- Riposte · cost S · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user is Deafened for 2 turns and Sapped. Invisible.
- applies: deafened, sapped · inline statuses: answering_peal · ops: apply
  - inline `answering_peal` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user is Deafened for 2 turns and Sapped.

### `rage.thunder` — Heaven's Anger
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Immune, and each time they gain Charge, a random enemy takes 10 damage.
- applies: might, immune · inline statuses: heavens_anger · ops: apply, damage
  - inline `heavens_anger` (Buff; triggers: effectGained): Each time the bearer gains Charge, a random enemy takes 10 damage.

### `shot.thunder` — Backflash
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. They lose all their Sapped, and the user gains 1 Charge per stack.
- applies: charged · ops: damage, set, removeEffect, apply

### `snipe.thunder` — Thunderbolt
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- Deals 10 damage to target enemy now, and they're Deafened for 1 turn. On the following turn, deals them 40 Piercing damage. Channeled.
- applies: deafened · inline statuses: thunderbolt · ops: damage, apply
  - inline `thunderbolt` (Neutral): Deals 40 Piercing damage to its target at the end of the following turn unless interrupted.

### `trap.thunder` — Storm Snare
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time one of target enemy's counters, reflects or Traps would trigger, it fails, and they take 25 damage and are Deafened for 2 turns. If nothing triggers it, they're Sapped when it ends. Invisible.
- applies: deafened, sapped · inline statuses: storm_snare · ops: apply, if, damage, removeSelf
  - inline `storm_snare` (Debuff, hidden; triggers: signal): The bearer's next counter, reflect or Trap fails, and they take 25 damage and are Deafened.

### `maneuver.thunder` — Second Flash
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn, and the last skill they used before this comes off cooldown.
- applies: invulnerable · ops: apply, resetCooldown

### `companion.thunder` — Thunderbird
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Thunderbird (30 HP) permanently. Wingclap (Sr): 10 damage to all enemies, Resound. When it dies, every enemy is Deafened for 1 turn.
- applies: deafened · inline statuses: thunderbird_bond · summons: thunderbird · ops: summon, apply, if
  - inline `thunderbird_bond` (Neutral; triggers: signal): When the bearer's Thunderbird dies, every enemy is Deafened for 1 turn.

### `bolt.thunder` — Thundercrack
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Resounds. Then every Echo on the enemy side, this one included, takes effect at once.
- macros: resound_it · ops: forEach, damage, macro, expire

### `blast.thunder` — Skyquake
- Blast · cost Srr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. Resound. The user spends all their Charge, and the echo repeats once more for each Charge spent, a turn apart.
- applies: resound_echo · ops: set, removeEffect, forEach, damage, apply, repeat

### `consume.thunder` — Ground Out
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. All Charge on the enemy side is removed, and the user heals 10 per Charge.
- ops: damage, set, removeEffect, heal

### `summon.thunder` — Thunderhead
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Thunderhead (25 HP) for 3 turns. At the end of each of the user's turns, it deals 20 damage to the unit with the most Charge on the field, either side (a random enemy if no one has any).
- summons: thunderhead · ops: summon

### `channel.thunder` — Drumroll
- Channel · cost r · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Channels for up to 3 turns with no effect until it ends. When it ends, every enemy takes 30 damage, and it Resounds. Channeled.
- inline statuses: drumroll · macros: resound_it · ops: apply, forEach, damage, macro
  - inline `drumroll` (Neutral): When it ends, every enemy takes 30 damage, and it Resounds.

### `stab.thunder` — Thunder Spike
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. The user spends all their Charge, and the target gains 1 Sapped per Charge spent.
- applies: sapped · ops: damage, set, removeEffect, apply

### `ravage.thunder` — Leaking Rend
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. For 2 turns, their Sapped can't be removed, and it takes effect at 2 stacks instead of 3.
- inline statuses: leaking_rend · ops: damage, apply, if, removeEffect
  - inline `leaking_rend` (Debuff; triggers: turnStart): Sapped takes effect at 2 stacks.

### `mislead.thunder` — Hush
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- Target enemy is Deafened for 1 turn. After that turn, for 1 turn, if they use a Harmful skill, it's countered and the user gains 1 Charge. Invisible.
- applies: deafened, charged · inline statuses: hush_gathering, hush · ops: apply
  - inline `hush_gathering` (Debuff, hidden): When this ends, the bearer gains Hush for their next turn.
  - inline `hush` (Debuff, hidden; triggers: skillUsed/counter): If the bearer uses a Harmful skill, it's countered and the user gains 1 Charge.

### `stun.thunder` — Concussion
- Stun · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and stuns their Strategic skills for 1 turn. Resound; when the echo lands, they're fully Stunned for 1 turn.
- applies: resound_echo_stun, stun_s · ops: forEach, damage, apply

### `dance.thunder` — Deafening Cadence
- Dance · cost SA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 2 Swiftness and 1 Focus, and each enemy they damage is Deafened for 1 turn. Each time a Deafened enemy's counter, reflect or Trap fails to trigger, the user gains 1 Charge.
- applies: swiftness, focus, deafened, charged · inline statuses: deafening_cadence · ops: apply
  - inline `deafening_cadence` (Buff; triggers: dealtDamage, signal): Deafens each enemy the bearer damages for 1 turn; gains 1 Charge each time an enemy's counter or Trap fails.

### `heal.thunder` — Overcapacity
- Heal · cost I · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. For 2 turns, their Charge can build past 3 to 5; at 5, it's spent and they generate 2 extra energy next turn.
- applies: overcapacity · ops: heal, apply

### `bless.thunder` — Grounding Touch
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 2 turns, each time target ally damages an enemy, one of the ally's Sapped stacks moves onto that enemy; if the ally has none, the enemy gains 1 Sapped.
- applies: sapped · inline statuses: grounding_touch · ops: apply, if, removeStacks
  - inline `grounding_touch` (Buff; triggers: dealtDamage): Each enemy the bearer damages takes one of the bearer's Sapped (or gains 1 Sapped).

### `curse.thunder` — Eardrum Burst
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Deafened for 2 turns, and gains 1 Sapped for each skill they use during it.
- applies: deafened, sapped · inline statuses: eardrum_burst · ops: apply
  - inline `eardrum_burst` (Debuff; triggers: skillUsed): Gains 1 Sapped for each skill the bearer uses.

### `smite.thunder` — Tolling Bolt
- Smite · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each time an ally damages them, every enemy takes 5 damage.
- inline statuses: tolling_bolt · ops: damage, apply
  - inline `tolling_bolt` (Debuff; triggers: damaged): Each time the applier's side damages the bearer, every one of the bearer's side takes 5 damage.

### `prayer.thunder` — Rolling Hymn
- Prayer · cost WW · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15. Until the user's next turn, each time an enemy uses a skill, all allies heal 10 more.
- inline statuses: rolling_hymn · ops: heal, apply
  - inline `rolling_hymn` (Debuff; triggers: skillUsed): Each skill the bearer uses heals the applier's allies 10.

### `cleave.thunder` — Forked Peal
- Cleave · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. Resound, but the Echo hits a random other enemy instead, at full strength.
- applies: resound_echo_fork · ops: forEach, damage, apply

### `shout.thunder` — Deafening Roar
- Shout · cost Sr · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Deafened for 2 turns, and any of them channeling a skill stops.
- applies: deafened · ops: apply, interrupt

### `withstand.thunder` — Thunder Cage
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- For 1 turn, direct hits on the user deal half damage, and each one Resounds back on its dealer: they take half of what it dealt (rounded up to 5) as their turn ends, and the user gains 1 Charge.
- applies: resound_echo · inline statuses: thunder_cage · ops: apply, if
  - inline `thunder_cage` (Buff; triggers: damaged): Direct hits on the bearer deal half damage, and each one's dealer takes half of what it dealt as their turn ends.

### `taunt.thunder` — Challenge Peal
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy until they damage the user, for up to 3 turns. They take half of that hit's damage (rounded up to 5) as their turn ends, and the user gains 1 Charge.
- applies: taunt, resound_echo · inline statuses: challenge_peal_duel, challenge_peal · ops: apply, if, removeEffect
  - inline `challenge_peal_duel` (Neutral): Lasts until the Taunted enemy damages the bearer.
  - inline `challenge_peal` (Debuff; triggers: dealtDamage): The bearer's first hit on the user who Taunted them ends the Taunt, and the bearer takes half that hit's damage as their turn ends.

### `titan.thunder` — Stormspire
- Titan · cost Wr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Immune, and enemy skills that would hit more than one of the user's allies hit only the user instead.
- applies: armor, immune · inline statuses: stormspire · ops: apply
  - inline `stormspire` (Buff): Enemy skills aimed at all of the bearer's side hit only the bearer.

### `thunderbird_wingclap` — Wingclap (minion skill of `thunderbird`)
- Minion · cost Sr · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies. Resound.
- macros: resound_it · ops: forEach, damage, macro

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `thunderbird` — Thunderbird, 30 HP; skills: thunderbird_wingclap
- `thunderhead` — Thunderhead, 25 HP; skills: none
  - passive `thunderhead_strike` (triggers: turnEnd): At the end of its owner's turn, deals 20 damage to the unit with the most Charge on the field, either side (a random enemy if no one has any).

## Named statuses defined here (6) — this group owns their default animations

- `deafened` — Deafened (Debuff): Counters, reflects and Traps that belong to the bearer can't trigger. _Applied by skills in: thunder._
- `resound_echo` — Echo (Neutral): When this runs out, the bearer takes its value as damage, and its owner gains 1 Charge. _Applied by skills in: thunder._
- `resound_echo_wide` — Rolling Echo (Neutral): When this runs out, the bearer and their allies take its value as damage, and its owner gains 1 Charge. _Applied by skills in: thunder._
- `resound_echo_fork` — Forked Echo (Neutral): When this runs out, a random other unit on the bearer's side takes its value as damage, and its owner gains 1 Charge. _Applied by skills in: thunder._
- `resound_echo_stun` — Concussive Echo (Neutral): When this runs out, the bearer takes its value as damage and is Stunned for 1 turn; its owner gains 1 Charge. _Applied by skills in: thunder._
- `overcapacity` — Overcapacity (Buff): Charge can build past 3 to 5; at 5, it's spent and the owner generates 2 extra energy next turn. _Applied by skills in: thunder._

## Macros defined here (1) — this group owns their default animations

- `resound_it`: ops apply; applies resound_echo. _Used by: thunder._
