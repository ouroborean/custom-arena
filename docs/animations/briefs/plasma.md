# Plasma — animation brief

Group id: `plasma`. Element(s): Fire + Lightning. Concept file: `docs/animations/concepts/plasma.yaml`.
Skill source: `packages/content/data/fusions/plasma/skills.plasma.yaml`; minions: `packages/content/data/fusions/plasma/minions.plasma.yaml`; statuses: `packages/content/data/fusions/plasma/statuses.plasma.yaml`; macros: `packages/content/data/fusions/plasma/macros.plasma.yaml`.

## Skills (31)

### `strike.plasma` — Searing Jolt
- Strike · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. +1 Heat; or, if the user already has 4 or more, Vent instead for 5 more damage per Heat removed.
- applies: heat · macros: vent · ops: if, macro, damage, apply

### `smash.plasma` — Coronal Slam
- Smash · cost SS · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies. Until they end, the Ignites on every enemy it hits deal double.
- inline statuses: coronal_slam · ops: damage, apply, if, removeSelf
  - inline `coronal_slam` (Debuff; triggers: turnEnd): The bearer's Ignite deals double (an extra 5 each time it ticks) until it ends.

### `charge.plasma` — Spark Rush
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. +2 Heat, then Vent: the user's next skill costs 1 less per 2 Heat removed.
- applies: heat, focus · macros: vent · ops: damage, apply, macro

### `riposte.plasma` — Discharge Ward
- Riposte · cost S · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the next Harmful skill used on the user. Vent: its user takes 10 Affliction damage per Heat removed and is Ignited. Invisible.
- applies: ignite · inline statuses: discharge_ward · macros: vent · ops: apply, macro, damage
  - inline `discharge_ward` (Buff, hidden; triggers: skillTargeted/counter): Counters the next Harmful skill used on the bearer. Vent: its user takes 10 Affliction damage per Heat removed and is Ignited.

### `rage.plasma` — Critical Mass
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- +2 Heat. For 3 turns, the user can't Melt Down, and gains 1 Heat at the start of each of their turns. If they're at 5 Heat when it ends, they Melt Down then.
- applies: heat · inline statuses: critical_mass · macros: meltdown · ops: apply, if, macro
  - inline `critical_mass` (Buff; triggers: turnStart): The bearer can't Melt Down and gains 1 Heat each turn; at 5 Heat when this ends, they Melt Down then.

### `shot.plasma` — Arc Spark
- Shot · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and arcs to a random other enemy for 10. +1 Heat.
- applies: heat · ops: damage, forEach, apply

### `snipe.plasma` — Coilgun
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user channels for up to 3 turns. When the channel ends (the user uses another skill, or 3 turns pass), it deals 30 Piercing damage to target enemy, +15 for each turn it was held. The target of this skill is invisible. Channeled.
- inline statuses: coilgun, coilgun_release · ops: setCounter, apply, removeEffect, damage, if
  - inline `coilgun` (Neutral; triggers: turnEnd): Each turn held adds 15 damage.
  - inline `coilgun_release` (Neutral; triggers: skillUsed): Deals the damage when the bearer uses another skill.

### `trap.plasma` — Thermite Seal
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy is healed, they're Scorched for 2 turns and they Explode. Invisible.
- applies: scorched · inline statuses: thermite_seal · macros: explode · ops: apply, macro
  - inline `thermite_seal` (Debuff, hidden; triggers: healed): The first time the bearer is healed, they're Scorched and Explode.

### `maneuver.plasma` — Heat Sink
- Maneuver · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. Vent: they gain 10 Shield per Heat removed, for 1 turn.
- applies: invulnerable, shield · macros: vent · ops: apply, macro, if

### `companion.plasma` — Ball Lightning
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Ball Lightning (25 HP) permanently. At the end of each of your turns, it deals 10 damage to a random enemy and gives the user 1 Heat. Detonate (r): it dies, dealing 20 damage to all enemies and Sapping them.
- summons: ball_lightning · ops: summon

### `bolt.plasma` — Superheated Bolt
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Ignites them. This Ignite deals 5 more per Heat the user has when it's applied. +1 Heat.
- applies: ignite, heat · inline statuses: superheated · ops: damage, apply, if, removeSelf
  - inline `superheated` (Debuff; triggers: turnEnd): The bearer's Ignite deals 5 more per stored Heat each time it ticks.

### `blast.plasma` — Overload Burst
- Blast · cost Srr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. The user Melts Down at the end of this turn, whatever their Heat.
- inline statuses: overload_burst · macros: meltdown · ops: damage, apply, macro
  - inline `overload_burst` (Neutral): Melts Down at the end of this turn.

### `consume.plasma` — Coolant Draw
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Saps them. Vent: the user heals 10 per Heat removed; if they had none, they gain 2 Heat instead.
- applies: sapped, heat · macros: vent · ops: macro, damage, apply, if, heal

### `summon.plasma` — Jumper Sparks
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons 2 Jumper Sparks (10 HP) for 3 turns. At the end of each of your turns, each deals 10 damage to a random enemy and gives a random ally 1 Charge.
- summons: jumper_spark · ops: summon

### `channel.plasma` — Arc Furnace
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies and Ignites a random one; then every enemy's Ignite ticks at once, and the user gains 1 Charge. Channeled.
- applies: ignite, charged · inline statuses: arc_furnace · ops: apply, damage
  - inline `arc_furnace` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies, an Ignite on one, every Ignite ticks, and 1 Charge.

### `stab.plasma` — Hot Wire
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. Vent: that threshold rises by 10 HP per Heat removed.
- macros: vent · ops: macro, damage

### `ravage.plasma` — Plasma Cutter
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy, +10 for each Charge the user spends on it (all of it). Each Charge spent becomes 1 Heat.
- applies: heat · ops: set, removeEffect, damage, apply

### `mislead.plasma` — Heat Shimmer
- Mislead · cost Sr · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they're Ignited. For 2 turns, that Ignite also ticks at the start of their own turns. Invisible.
- applies: ignite · inline statuses: heat_shimmer, heat_shimmer_burn · ops: apply, if, damage
  - inline `heat_shimmer` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered and Ignites them.
  - inline `heat_shimmer_burn` (Debuff; triggers: turnStart): The bearer's Ignite also ticks at the start of their turns.

### `stun.plasma` — Short Circuit
- Stun · cost AA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and stuns their non-Strategic skills for 1 turn. Vent: for every 2 Heat removed, a random other enemy is stunned the same way.
- applies: stun_ns · macros: vent · ops: macro, damage, apply, repeat

### `dance.plasma` — Star Core
- Dance · cost SA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Stormborn, and can't be Stunned while they have 3 or more Heat.
- applies: might, stormborn · inline statuses: star_core · ops: apply
  - inline `star_core` (Buff): Stuns don't land on the bearer while they have 3 or more Heat.

### `heal.plasma` — Cauterizing Shock
- Heal · cost I · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. Vent: they gain 1 Charge per 2 Heat removed.
- applies: charged · macros: vent · ops: heal, macro, apply

### `bless.plasma` — Supercharge
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally's Charge fills to 3 at once, and they gain 1 Might for 3 turns. For those 3 turns, they can't gain Charge.
- applies: charged, might · inline statuses: supercharge · ops: apply
  - inline `supercharge` (Neutral): Can't gain Charge.

### `curse.plasma` — Power Surge
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 2 turns, each skill target enemy uses deals them 5 Affliction damage per energy in its cost.
- inline statuses: power_surge · ops: apply, damage
  - inline `power_surge` (Debuff; triggers: skillUsed): Each skill the bearer uses deals them 5 Affliction damage per energy in its cost.

### `smite.plasma` — Arc Brand
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and brands them for 1 turn. Each time an ally deals direct damage to them meanwhile, the brand gains 10; when it ends, they take that much Affliction damage.
- inline statuses: arc_brand · ops: damage, apply, addStacksSelf
  - inline `arc_brand` (Debuff; triggers: damaged): Each direct hit from the applier's side adds 10; when it ends, the bearer takes that much Affliction damage.

### `prayer.plasma` — Heat Exchange
- Prayer · cost SS · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and gain 10 Shield for 1 turn. If the user Melts Down before their next turn, the Meltdown heals every ally 20 and doesn't hurt the user.
- applies: shield · inline statuses: heat_exchange · ops: heal, apply
  - inline `heat_exchange` (Buff): The bearer's next Meltdown heals every ally 20 instead of hurting them.

### `cleave.plasma` — Breaker Arc
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy. Any channel either of them holds is broken, and neither can start one until the user's next turn.
- applies: breaker_arc · ops: damage, forEach, interrupt, apply

### `shout.plasma` — Grid Collapse
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns, and every minion in the battle, on both sides, is Stunned for 2 turns.
- applies: intimidated, stun · ops: apply

### `withstand.plasma` — Overcharged Barrier
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 50 Shield for 1 turn. Their next skill costs 2 more energy.
- applies: shield · inline statuses: overcharge_surge · ops: apply
  - inline `overcharge_surge` (Neutral): The bearer's next skill costs 2 more energy.

### `taunt.plasma` — Flare Beacon
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 1 turn. Vent: 1 more turn if any Heat was removed, and 1 Sapped per 2 Heat removed.
- applies: taunt, sapped · macros: vent · ops: macro, apply

### `titan.plasma` — Reactor Core
- Titan · cost Wr · cooldown 4 · target **self** · tags Helpful, Strategic
- The user's Heat rises by 2, to at most 4. For 3 turns, they gain Immune and 1 Armor per Heat they have, checked as each hit lands.
- applies: heat, immune · inline statuses: reactor_core · ops: if, apply
  - inline `reactor_core` (Buff): 1 Armor per Heat the bearer has (−5 Normal damage taken each).

### `ball_lightning_detonate` — Detonate (minion skill of `ball_lightning`)
- Minion · cost r · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- The Ball Lightning dies, dealing 20 damage to all enemies and Sapping them.
- applies: sapped · ops: damage, apply, kill

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `ball_lightning` — Ball Lightning, 25 HP; skills: ball_lightning_detonate
  - passive `ball_lightning_arc` (triggers: turnEnd): At the end of its owner's turn, deals 10 damage to a random enemy and gives its summoner 1 Heat.
- `jumper_spark` — Jumper Spark, 10 HP; skills: none
  - passive `jumper_spark_arc` (triggers: turnEnd): At the end of its owner's turn, deals 10 damage to a random enemy and gives a random ally 1 Charge.

## Named statuses defined here (3) — this group owns their default animations

- `heat` — Heat (Neutral): The bearer's Plasma skills deal 5 more damage per Heat. At the end of their turn with 5 Heat, they Melt Down. _Applied by skills in: plasma._
- `plasma_core` — Plasma Core (Neutral; triggers: effectGained, turnEnd): Gains 1 Heat whenever this character gains Charge. At the end of their turn with 5 Heat, they Melt Down: they take 20 Affliction, every enemy takes 20 Affliction and is Sapped, and Heat returns to 0. _Applied by skills in: none directly._
- `breaker_arc` — Broken Circuit (Debuff): Can't use Channeled skills. _Applied by skills in: plasma._

## Macros defined here (2) — this group owns their default animations

- `meltdown`: ops if, heal, removeEffect, damage, apply; applies sapped. _Used by: plasma._
- `vent`: ops set, removeEffect. _Used by: plasma._
