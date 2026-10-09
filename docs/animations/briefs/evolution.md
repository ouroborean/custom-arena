# Evolution — animation brief

Group id: `evolution`. Element(s): Poison + Poison. Concept file: `docs/animations/concepts/evolution.yaml`.
Skill source: `packages/content/data/fusions/evolution/skills.evolution.yaml`; minions: `packages/content/data/fusions/evolution/minions.evolution.yaml`; statuses: `packages/content/data/fusions/evolution/statuses.evolution.yaml`.

## Skills (32)

### `strike.evolution` — Mutant Fang
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Mutates every use, I → II → III → I; each stage replaces the last. I: 20 Piercing damage to target enemy. II: 10 damage and 2 Toxin. III: 10 damage, and their Toxin ticks twice now.
- applies: toxin · ops: set, if, damage, repeat, apply, setCounter

### `smash.evolution` — Primal Stomp
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 2 Toxin. Each of their allies takes 5 damage per Toxin the target has (at most 25).
- applies: toxin · ops: damage, apply

### `charge.evolution` — Scent Trail
- Charge · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- I: 10 damage and 1 Toxin to target enemy, and the user gains 1 Focus. II: 2 Toxin instead. III: a random other enemy also gains 1 Toxin.
- applies: toxin, focus · ops: damage, apply, if

### `riposte.evolution` — Molt
- Riposte · cost W · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn. I: if the user takes direct damage, they heal 15. II: they also lose their Debuffs. III: the skill that hit them is countered instead. Invisible.
- inline statuses: molt_iii, molt · ops: if, apply, heal, removeKind
  - inline `molt_iii` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; they heal 15 and lose their Debuffs.
  - inline `molt` (Buff, hidden; triggers: damaged): The first time the bearer takes direct damage, they heal 15 (and at Stage II lose their Debuffs).

### `rage.evolution` — Apex Predator
- Rage · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, each enemy the user hits is marked as Prey for 2 turns, and the user's hits deal 10 more damage to Prey.
- applies: prey · inline statuses: apex_predator · ops: apply
  - inline `apex_predator` (Buff; triggers: dealtDamage): Each enemy the bearer hits is marked as Prey for 2 turns; their hits deal 10 more damage to Prey.

### `shot.evolution` — Telltale Venom
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage and 1 Toxin to target enemy. Until the end of the user's next turn, every enemy with any Toxin counts as Prey.
- applies: toxin, telltale_venom · ops: damage, apply

### `snipe.evolution` — Barbed Quill
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget, Uncounterable
- On the following turn, target enemy gains Barbed Quill for 3 turns: at the end of each of the user's turns, they take 10 Affliction damage, then 15, then 20. The target of this skill is invisible. Channeled, Uncounterable.
- inline statuses: barbed_quill, barbed_quill_barb · ops: apply, damage, addStacksSelf
  - inline `barbed_quill` (Neutral): At the end of the following turn, gives its target Barbed Quill unless interrupted.
  - inline `barbed_quill_barb` (Debuff; triggers: turnEnd): At the end of each of the applier's turns, the bearer takes 10 Affliction damage, then 15, then 20.

### `trap.evolution` — Nesting Pit
- Trap · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, each time target enemy uses a Strategic skill, the user summons a Larva for 2 turns. If none was summoned when it ends, they gain 2 Toxin. Invisible.
- applies: toxin · inline statuses: nesting_pit · summons: larva · ops: apply, summon, addStacksSelf, if
  - inline `nesting_pit` (Debuff, hidden; triggers: skillUsed): Each Strategic skill the bearer uses summons a Larva for the applier for 2 turns; if none is summoned, the bearer gains 2 Toxin when this ends.

### `maneuver.evolution` — Slough Off
- Maneuver · cost W · cooldown 2 · target **self** · tags Helpful, Strategic, Unstunnable
- The user becomes Invulnerable for 1 turn and loses all their Debuffs, and the last enemy who damaged them gains 1 Toxin per Debuff stack removed (at least 1, at most 3). Unstunnable.
- applies: invulnerable, toxin · ops: set, removeKind, apply

### `companion.evolution` — Brood Parasite
- Companion · cost I · cooldown 1 · target **enemy** · tags Harmful, Strategic
- Summons a Parasite (20 HP) permanently, attached to target enemy: enemies can't target it, and it dies with them. Feed (r): its host loses 10 HP, and the user's ally with the least HP heals 10.
- applies: parasite_host · summons: parasite · ops: summon, apply

### `bolt.evolution` — Corrosive Glob
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- I: 20 damage to target enemy; 1 of their Armor turns into Vulnerable. II: all of it does. III: they also lose their Shield, gaining 1 Toxin per 10 removed.
- applies: vulnerable, toxin · ops: damage, set, if, removeStacks, removeEffect, apply, removeShields

### `blast.evolution` — Extinction Event
- Blast · cost II · cooldown 3 · target **none** · tags Harmful, NonStrategic
- Deals 30 Affliction damage to every unit on both sides, minions and the user included, except those at or above 60 HP.
- ops: damage

### `consume.evolution` — Cull the Weak
- Consume · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 3 Toxin, then all their Toxin is removed: they die if their HP is at most 5 per stack removed; otherwise the user heals 5 per stack.
- applies: toxin · ops: apply, set, removeEffect, if, kill, heal

### `summon.evolution` — Larva Swarm
- Summon · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons 2 Larvae (15 HP). Nibble (W): 5 Piercing damage and 1 Toxin. I: they last 3 turns. II: whoever kills a Larva gains 2 Toxin. III: they no longer expire.
- applies: toxin · inline statuses: larva_venom · summons: larva · ops: if, summon, apply
  - inline `larva_venom` (Buff; triggers: signal): Whoever kills one of the bearer's Larvae gains 2 Toxin.

### `channel.evolution` — Plague Strain
- Channel · cost Wrr · cooldown 5 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 6 turns; it mutates each turn, I → II → III → I, each stage replacing the last. I: all enemies gain 1 Toxin. II: 10 Affliction damage to all enemies. III: each enemy with Toxin gains 1 Weakness for 1 turn. Channeled.
- applies: weakness, toxin · inline statuses: plague_strain · ops: apply, if, addStacksSelf, damage
  - inline `plague_strain` (Neutral; triggers: turnEnd): Mutates each turn, I → II → III → I. I, Toxin to all enemies; II, 10 Affliction to all; III, Weakness to those with Toxin.

### `stab.evolution` — Opportunist
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- I: 5 Piercing damage; against Prey, the user gains 1 random energy. II: 15 Piercing against targets at or below 40 HP. III: it executes Prey below 15 HP.
- ops: if, kill, gainEnergy, damage

### `ravage.evolution` — Envenomed Rend
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Bypass
- Removes up to 2 Toxin from target enemy, then deals them 20 Piercing damage, Bypassing Invulnerable, plus 10 per Toxin removed.
- ops: set, repeat, removeStacks, damage

### `mislead.evolution` — Warning Colors
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn. I: if target enemy uses a Harmful skill, it's countered and they gain 1 Toxin. II: 1 Toxin per energy it cost. III: it's visible, and any enemy's Harmful skill triggers it. Invisible.
- applies: toxin · inline statuses: warning_colors_iii, warning_colors · ops: if, apply, removeEffect
  - inline `warning_colors_iii` (Debuff; triggers: skillUsed/counter): The first Harmful skill any of these enemies uses is countered, and its user gains 1 Toxin per energy it cost.
  - inline `warning_colors` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Harmful skill is countered and they gain Toxin.

### `stun.evolution` — Paralytic Bite
- Stun · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 2 Toxin. At the end of their next turn, if they still have any Toxin, they're Stunned for 1 turn.
- applies: toxin, stun · inline statuses: paralytic_bite · ops: apply, if
  - inline `paralytic_bite` (Debuff): When this ends, the bearer is Stunned for 1 turn if they still have any Toxin.

### `dance.evolution` — Adaptive Hide
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness at the start of each of their turns. Each enemy skill that damages them meanwhile deals 5 less to them for the rest of the match (max 15 per skill).
- applies: swiftness · inline statuses: adaptive_hide · ops: apply
  - inline `adaptive_hide` (Buff; triggers: turnStart): Gains 1 Swiftness each turn; each enemy skill that damages the bearer deals 5 less to them for the rest of the match (max 15).

### `heal.evolution` — Regenerate
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- I: target ally heals 20. II: they lose their Toxin and heal 10 more per stack removed. III: the same healing repeats at the start of their next turn.
- inline statuses: regenerate · ops: set, if, removeEffect, heal, apply, removeSelf
  - inline `regenerate` (Buff; triggers: turnStart): The healing repeats at the start of the bearer's next turn.

### `bless.evolution` — Hormesis
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might, and Toxin on them heals them for its damage instead of harming them.
- applies: might, hormesis · ops: apply

### `curse.evolution` — Delirium
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Confusion for 2 turns. Meanwhile, each Debuff stack on them counts as 2 toward Prey.
- applies: confusion, delirium · ops: apply

### `smite.evolution` — Stalking Mark
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. After 2 turns, they gain 1 Toxin for each time the user or an ally damaged them in between (at least 1, at most 4).
- applies: toxin · inline statuses: stalking_mark · ops: damage, apply, addStacksSelf
  - inline `stalking_mark` (Debuff; triggers: damaged): When this ends, the bearer gains 1 Toxin for each time their enemies damaged them meanwhile (at least 1, at most 4).

### `prayer.evolution` — Symbiotic Song
- Prayer · cost Wr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All enemies gain 1 Toxin. For 2 turns, each time an enemy's Toxin ticks, a random ally heals 10.
- applies: toxin · inline statuses: symbiotic_song · ops: apply, if, heal
  - inline `symbiotic_song` (Debuff; triggers: damaged): Each time the bearer's Toxin ticks, a random ally of the applier heals 10.

### `cleave.evolution` — Thrashing Tail
- Cleave · cost S · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to a random enemy 4 times. Each enemy hit more than once also gains 1 Toxin.
- applies: toxin · inline statuses: thrashing_tail · ops: repeat, forEach, damage, apply, removeEffect
  - inline `thrashing_tail` (Neutral): Hits taken from this Thrashing Tail.

### `shout.evolution` — Festering Howl
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- The user gains 1 Toxin, then all enemies are Intimidated for 1 turn per Toxin the user has (at most 3).
- applies: toxin, intimidated · ops: apply

### `withstand.evolution` — Exoskeleton
- Withstand · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 10 Shield for 3 turns. At the start of each of their turns, it gains 10 Shield.
- applies: exoskeleton · ops: apply

### `taunt.evolution` — Hypnotic Hood
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted and counts as Prey for 2 turns. If they don't damage the user during it, they fall Asleep when it ends.
- applies: taunt, prey, sleep · inline statuses: hypnotic_hood · ops: apply, if, removeSelf
  - inline `hypnotic_hood` (Debuff; triggers: dealtDamage): If the bearer doesn't damage the applier before this ends, they fall Asleep.

### `titan.evolution` — Chrysalis
- Titan · cost W · cooldown 4 · target **self** · tags Helpful, Strategic
- The user is Stunned and Invulnerable for 1 turn. Then, for 3 turns, they gain 3 Armor, 2 Might and Immune.
- applies: stun, invulnerable, armor, might, immune · inline statuses: chrysalis · ops: apply
  - inline `chrysalis` (Buff): When this ends, the bearer gains 3 Armor, 2 Might and Immune for 3 turns.

### `parasite_feed` — Feed (minion skill of `parasite`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Its host loses 10 HP, and the user's ally with the least HP heals 10.
- ops: damage, heal

### `larva_nibble` — Nibble (minion skill of `larva`)
- Minion · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage and 1 Toxin to target enemy.
- applies: toxin · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `parasite` — Parasite, 20 HP; skills: parasite_feed
  - passive `parasite_lodged` (triggers: signal): Can't be targeted by enemy skills. Dies with its host.
- `larva` — Larva, 15 HP; skills: larva_nibble

## Named statuses defined here (5) — this group owns their default animations

- `telltale_venom` — Telltale Venom (Debuff): While the bearer has any Toxin, they count as Prey. _Applied by skills in: evolution._
- `delirium` — Delirium (Debuff): Each Debuff stack on the bearer counts as 2 toward Prey. _Applied by skills in: evolution._
- `hormesis` — Hormesis (Buff): Toxin on the bearer heals them for its damage instead of harming them. _Applied by skills in: assassin, evolution._
- `exoskeleton` — Exoskeleton (Buff; triggers: turnStart): A Shield that gains 10 at the start of each of the bearer's turns. _Applied by skills in: evolution._
- `parasite_host` — Parasite Host (Debuff): Carries a Parasite. Only this unit can target it, and it dies with them. _Applied by skills in: evolution._
