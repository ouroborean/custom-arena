# Stasis — animation brief

Group id: `stasis`. Element(s): Ice + Poison. Concept file: `docs/animations/concepts/stasis.yaml`.
Skill source: `packages/content/data/fusions/stasis/skills.stasis.yaml`; minions: `packages/content/data/fusions/stasis/minions.stasis.yaml`; statuses: `packages/content/data/fusions/stasis/statuses.stasis.yaml`; macros: `packages/content/data/fusions/stasis/macros.stasis.yaml`.

## Skills (32)

### `strike.stasis` — Ticking Venom
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Until the user's next turn, their Toxin also deals its damage each time they use a skill.
- inline statuses: ticking_venom · ops: damage, apply
  - inline `ticking_venom` (Debuff; triggers: skillUsed): Each skill the bearer uses makes their Toxin deal its damage.

### `smash.stasis` — Frozen Stomp
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy, who is Suspended for 1 turn. When they Thaw, each of their allies takes half the Thaw's damage.
- applies: suspended · inline statuses: frozen_stomp · ops: damage, apply
  - inline `frozen_stomp` (Debuff): When the bearer Thaws, each of their allies takes half the Thaw's damage.

### `charge.stasis` — Freezing Lunge
- Charge · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains 1 Toxin. The user's next Harmful skill makes its targets' Toxin deal its damage at once, doubled.
- applies: toxin · inline statuses: freezing_lunge · macros: thaw · ops: damage, apply, forEach, macro
  - inline `freezing_lunge` (Buff; triggers: skillUsed): The bearer's next Harmful skill makes its targets' Toxin deal its damage at once, doubled.

### `riposte.stasis` — Freeze Frame
- Riposte · cost I · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user; its user gains 2 Toxin and is Suspended for 1 turn, so the Toxin lands later as a Thaw. Invisible.
- applies: toxin, suspended · inline statuses: freeze_frame · ops: apply
  - inline `freeze_frame` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; their users gain Toxin and are Suspended.

### `rage.stasis` — Stopped Clock
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Immune, and their skills don't go on cooldown. When it ends, every skill of theirs goes 2 turns onto cooldown.
- applies: might, immune · inline statuses: stopped_clock · ops: apply, adjustCooldowns
  - inline `stopped_clock` (Buff): The bearer's skills don't go on cooldown; when this ends, they all go 2 turns onto cooldown.

### `shot.stasis` — Rime Needle
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy, who is Chilled for 1 turn. Then each Frost debuff on them lasts 1 turn longer.
- applies: chilled · ops: damage, apply, extendEffects

### `snipe.stasis` — Release
- Snipe · cost AIr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- Target enemy is Suspended. At the end of the following turn, they take 30 Piercing damage, and then they Thaw. Channeled.
- applies: suspended · inline statuses: release · ops: apply, damage
  - inline `release` (Neutral): At the end of the following turn, deals 30 Piercing damage to its target.

### `trap.stasis` — Cold Pit
- Trap · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy is healed, they gain 2 Toxin and are Suspended for 1 turn, stalling their Renew. Invisible.
- applies: toxin, suspended · inline statuses: cold_pit · ops: apply
  - inline `cold_pit` (Debuff, hidden; triggers: healed): The first time the bearer is healed, they gain 2 Toxin and are Suspended.

### `maneuver.stasis` — Cryosleep
- Maneuver · cost I · cooldown 3 · target **self** · tags Helpful, Strategic, Unstunnable
- The user becomes Invulnerable for 1 turn and is Suspended for 2, so their Buffs and Debuffs don't tick or lose duration. Unstunnable.
- applies: invulnerable, suspended_ally · ops: apply

### `companion.stasis` — Ice Spider
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Ice Spider (30 HP) permanently. Frost Web (r): target enemy is Suspended for 1 turn. Frozen Fang (r): 5 Piercing damage and 1 Toxin; a Suspended target Thaws at once instead.
- summons: ice_spider · ops: summon

### `bolt.stasis` — Chilling Acid
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, each time their Toxin ticks, they're Chilled for 1 more turn.
- applies: chilled · inline statuses: chilling_acid · ops: damage, apply, if, extendEffects
  - inline `chilling_acid` (Debuff; triggers: turnEnd): Each time the bearer's Toxin ticks, they're Chilled 1 turn more.

### `blast.stasis` — Absolute Stillness
- Blast · cost Wr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Then every unit on both sides, the user included, is Suspended for 1 turn.
- macros: suspend · ops: damage, forEach, macro

### `consume.stasis` — Final Thaw
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Toxin. Then their Toxin deals its damage at once, doubled, and the user heals as much as it deals.
- applies: toxin · macros: thaw · ops: apply, forEach, macro, heal

### `summon.stasis` — Cryo Sprite
- Summon · cost I · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons a Cryo Sprite (20 HP) for 3 turns. At the end of each of the user's turns, it gives the enemy with the least HP 1 Toxin, or Suspends them for 1 turn instead if they're Prey.
- summons: cryo_sprite · ops: summon

### `channel.stasis` — Nine Winters
- Channel · cost Irr · cooldown 5 · target **allEnemies** · tags Harmful, Strategic, Channeled
- For up to 4 turns, every enemy is Suspended, and at the end of each of the user's turns a random enemy gains 1 Toxin. When it ends, they all Thaw. Channeled.
- applies: toxin · inline statuses: nine_winters, nine_winters_hold, nine_winters_end · macros: thaw · ops: apply, removeSelf, forEach, macro
  - inline `nine_winters` (Neutral; triggers: turnEnd): Every enemy stays Suspended; each turn, a random one gains 1 Toxin.
  - inline `nine_winters_hold` (Debuff): Suspended while the Nine Winters last.
  - inline `nine_winters_end` (Neutral; triggers: ownEffectEnded): When the Nine Winters end, every enemy Thaws.

### `stab.stasis` — Icebite
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, who gains 1 Toxin, plus 5 more damage for each turn the user went without using Icebite (max 15 more).
- applies: toxin · ops: set, damage, apply, setCounter

### `ravage.stasis` — Cryo Rend
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy, who is Suspended for 1 turn. When they Thaw, they take 20 Piercing damage again.
- inline statuses: cryo_rend · macros: thaw · ops: damage, apply, forEach, macro
  - inline `cryo_rend` (Debuff): Suspended. When the bearer Thaws, they take 20 Piercing damage.

### `mislead.stasis` — Lingering Frost
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and every Debuff on them, Stuns aside, lasts 2 turns longer. Invisible.
- inline statuses: lingering_frost · ops: apply, extendEffects
  - inline `lingering_frost` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and every Debuff on them, Stuns aside, lasts 2 turns longer.

### `stun.stasis` — Hold
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 2 Toxin and is Suspended for 1 turn. When they Thaw, they're Stunned for 1 turn.
- applies: toxin, stun · inline statuses: hold · macros: thaw · ops: apply, forEach, macro
  - inline `hold` (Debuff): Suspended. When the bearer Thaws, they're Stunned for 1 turn.

### `dance.stasis` — Frozen Waltz
- Dance · cost AI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Suspended, so their Buffs hold. At the end of each of their turns meanwhile, they gain 1 Might and 1 Swiftness; these pile up while the Suspension holds them, then last 1 turn more.
- applies: suspended_ally, might, swiftness · inline statuses: frozen_waltz · ops: apply
  - inline `frozen_waltz` (Buff; triggers: turnEnd): At the end of each of the bearer's turns, they gain 1 Might and 1 Swiftness.

### `heal.stasis` — Cold Storage
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 25 and loses their Toxin, then is Suspended for 1 turn.
- applies: suspended_ally · ops: heal, removeEffect, apply

### `bless.stasis` — Preserved Vigor
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 2 Might for 2 turns, then is Suspended for 2 turns so their Buffs hold.
- applies: might, suspended_ally · ops: apply

### `curse.stasis` — Stilled Blood
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused and Suspended for 2 turns. Each skill they use meanwhile adds 1 Toxin to them, held for the Thaw.
- applies: confusion, suspended, toxin · inline statuses: stilled_blood · ops: apply
  - inline `stilled_blood` (Debuff; triggers: skillUsed): Each skill the bearer uses adds 1 Toxin.

### `smite.stasis` — Frozen Quarry
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Suspended for 1 turn. Damage the user's side deals them meanwhile is recorded: when they Thaw, they take half of it again as Affliction damage (max 30).
- inline statuses: frozen_quarry · macros: thaw · ops: damage, setCounter, apply, forEach, macro
  - inline `frozen_quarry` (Debuff; triggers: damaged): Suspended. Damage the bearer's enemies deal them is recorded; when they Thaw, they take half of it again (max 30).

### `prayer.stasis` — Hymn of Stillness
- Prayer · cost Ir · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and lose their Toxin, gaining 10 Shield for 1 turn for each stack lost.
- applies: shield · ops: heal, forEach, set, removeEffect, if, apply

### `cleave.stasis` — Frozen Lash
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to a random other enemy, who gains as much Toxin as the target has (max 3) and is Suspended for 1 turn.
- applies: toxin, suspended · ops: damage, forEach, apply

### `shout.stasis` — Hoarfrost Hush
- Shout · cost Ir · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Chilled for 4 turns and Suspended for 1, so the Chill holds. Any who were already Chilled gain 1 Toxin first.
- applies: toxin, chilled, suspended · ops: forEach, if, apply

### `withstand.stasis` — Hold the Moment
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 10 Shield for 1 turn. At the start of their next turn, they heal all the HP they lost since using this, up to 40.
- applies: shield · inline statuses: hold_the_moment · ops: apply, setCounter, set, if, heal
  - inline `hold_the_moment` (Buff): At the start of the bearer's next turn, they heal the HP lost since (up to 40).

### `taunt.stasis` — Cold Grudge
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 2 turns, target enemy is Taunted by the user, and each time they damage the user, they gain 1 Toxin. Then their Toxin deals its damage at once, doubled.
- applies: taunt, toxin · inline statuses: cold_grudge · macros: thaw · ops: apply, if, forEach, macro
  - inline `cold_grudge` (Debuff; triggers: dealtDamage): Each time the bearer damages the one who Taunted them, they gain 1 Toxin; when this ends, their Toxin deals its damage at once, doubled.

### `titan.stasis` — Frozen Instant
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune, and damage they take is delayed instead of dealt. Each delayed hit is dealt 3 turns later, halved, as Affliction.
- applies: immune · inline statuses: frozen_instant · ops: apply
  - inline `frozen_instant` (Buff): Damage the bearer takes is delayed, and dealt 3 turns later, halved.

### `ice_spider_frost_web` — Frost Web (minion skill of `ice_spider`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Suspended for 1 turn.
- applies: suspended · ops: apply

### `ice_spider_frozen_fang` — Frozen Fang (minion skill of `ice_spider`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy and gives them 1 Toxin; a Suspended target Thaws at once instead.
- applies: toxin · ops: if, expire, damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `ice_spider` — Ice Spider, 30 HP; skills: ice_spider_frost_web, ice_spider_frozen_fang
- `cryo_sprite` — Cryo Sprite, 20 HP; skills: none
  - passive `cryo_sprite_watch` (triggers: turnEnd): At the end of its owner's turn, the enemy with the least HP gains 1 Toxin, or is Suspended for 1 turn instead if they're Prey.

## Named statuses defined here (3) — this group owns their default animations

- `suspended` — Suspended (Debuff): The bearer's effects don't tick, lose duration or deal damage while it lasts. When it ends, they Thaw: their Toxin deals its damage at once, doubled. _Applied by skills in: stasis._
- `suspended_ally` — Suspended (Buff): The bearer's effects don't tick or lose duration while it lasts, so their Buffs hold. When it ends, they Thaw: their Toxin deals its damage at once, doubled. _Applied by skills in: stasis._
- `frozen_instant_hit` — Frozen Instant (Neutral): When this runs out, the bearer takes half its value as Affliction damage. _Applied by skills in: none directly._

## Macros defined here (2) — this group owns their default animations

- `thaw`: ops if, damage. _Used by: stasis._
- `suspend`: ops if, apply; applies suspended, suspended_ally. _Used by: stasis._
