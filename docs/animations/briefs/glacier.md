# Glacier — animation brief

Group id: `glacier`. Element(s): Ice + Water. Concept file: `docs/animations/concepts/glacier.yaml`.
Skill source: `packages/content/data/fusions/glacier/skills.glacier.yaml`; minions: `packages/content/data/fusions/glacier/minions.glacier.yaml`; statuses: `packages/content/data/fusions/glacier/statuses.glacier.yaml`.

## Skills (32)

### `strike.glacier` — Glacial Fist
- Strike · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy, and they're Icebound for 1 turn. If they already were, the user gains Meltwater for 1 turn instead.
- applies: meltwater, icebound · ops: damage, if, apply

### `smash.glacier` — Spring Breakup
- Smash · cost Srr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to their allies. The user spends all their Renew: each stack adds 5 to every hit.
- ops: set, removeEffect, damage

### `charge.glacier` — Meltwater Rush
- Charge · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user gains Meltwater for 1 turn, or 2 if the target has a skill on cooldown.
- applies: meltwater · ops: damage, apply

### `riposte.glacier` — Pressure Ridge
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; they gain Meltwater for 1 turn per turn of that skill's cooldown (max 3). Invisible.
- applies: meltwater · inline statuses: pressure_ridge · ops: apply, if
  - inline `pressure_ridge` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; they gain Meltwater for 1 turn per turn of that skill's cooldown (max 3).

### `rage.glacier` — Spring Thaw
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune and Meltwater; each time Meltwater brings one of their skills off cooldown, they gain 1 Might until it ends.
- applies: immune, meltwater, might · inline statuses: spring_thaw · ops: apply, if
  - inline `spring_thaw` (Buff; triggers: turnStart): Each time Meltwater brings one of the bearer's skills off cooldown, they gain 1 Might until this ends.

### `shot.glacier` — Borrowed Hour
- Shot · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. Their skill with the longest cooldown left and the user's other skill with the longest cooldown left swap cooldowns.
- ops: damage, swapCooldowns

### `snipe.glacier` — Serac Spear
- Snipe · cost AIr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 50 Piercing damage to target enemy. If they're Icebound, it lands at once instead, and their Icebound ends. The target of this skill is invisible. Channeled.
- inline statuses: serac_spear · ops: if, damage, removeEffect, apply
  - inline `serac_spear` (Neutral): At the end of the following turn, deals 50 Piercing damage to its target unless interrupted.

### `trap.glacier` — Crevasse
- Trap · cost II · cooldown 4 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, if target enemy uses a Harmful skill, they're Icebound for 2 turns and their cooldowns rise by 1. Invisible.
- applies: icebound · inline statuses: crevasse · ops: apply, adjustCooldowns
  - inline `crevasse` (Debuff, hidden; triggers: skillResolved): When the bearer next uses a Harmful skill, they're Icebound for 2 turns and their cooldowns rise by 1.

### `maneuver.glacier` — Under the Ice
- Maneuver · cost I · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn, and every enemy with a skill on cooldown is Icebound for 1 turn.
- applies: invulnerable, icebound · ops: apply

### `companion.glacier` — Walrus Bull
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Walrus (45 HP) permanently. Tusk (S): 20 damage to target enemy. Haul Out (r): target ally gains Meltwater for 2 turns, and the Walrus is Icebound for as long.
- summons: walrus_bull · ops: summon

### `bolt.glacier` — Stolen Season
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. A random skill of theirs still on cooldown gains 1 turn of cooldown, and a random other skill of the user's still on cooldown loses 1.
- ops: damage, adjustCooldowns

### `blast.glacier` — Thawburst
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Every Frost debuff on them is removed, and a random ally of the user gains 2 Renew for each.
- applies: renew · ops: damage, forEach, set, removeEffect, if, apply

### `consume.glacier` — Stolen Thaw
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. If they're Icebound, it ends, and the user gains Meltwater for 2 turns; otherwise they're Icebound for 1 turn.
- applies: meltwater, icebound · ops: damage, heal, if, removeEffect, apply

### `summon.glacier` — Advancing Glacier
- Summon · cost Ir · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons an Ice Tongue (50 HP) for 4 turns. It does nothing for its first 2 turns; then, at the end of each of your turns, it deals 30 Piercing damage to a random enemy.
- summons: ice_tongue · ops: summon

### `channel.glacier` — Glacial Advance
- Channel · cost I · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, deals 10 damage to target enemy, who is Icebound for 1 turn. While it channels, the user's cooldowns don't tick either. Channeled.
- applies: icebound · inline statuses: glacial_advance · ops: apply, damage
  - inline `glacial_advance` (Neutral; triggers: turnEnd): At the end of each of the bearer's turns, deals 10 damage to the target, who is Icebound for 1 turn. The bearer's cooldowns don't tick down.

### `stab.glacier` — Hoarfrost Pick
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. A random other skill of the user's still on cooldown gains 1 turn of cooldown. If none is on cooldown, this skill goes on cooldown for 1 turn instead.
- ops: damage, if, adjustCooldowns

### `ravage.glacier` — Scouring Melt
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, +10 per Confusion they have (max 3). Then they lose all their Confusion.
- ops: damage, removeEffect

### `mislead.glacier` — Thin Ice
- Mislead · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- The user is Icebound for up to 3 turns. Meanwhile, the first Harmful skill target enemy uses is countered, the user's Icebound ends, and they gain Meltwater for 1 turn. Invisible.
- applies: icebound, meltwater · inline statuses: thin_ice · ops: apply, removeEffect
  - inline `thin_ice` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Harmful skill is countered, and the applier's Icebound ends and they gain Meltwater for 1 turn.

### `stun.glacier` — Pack Ice
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Stuns them for 2 turns. The user is also Icebound for as long.
- applies: stun, icebound · ops: damage, apply

### `dance.glacier` — Spring Current
- Dance · cost Ar · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and Meltwater, and each ally they use a Helpful skill on gains Meltwater for 1 turn.
- applies: swiftness, meltwater · inline statuses: spring_current · ops: apply
  - inline `spring_current` (Buff; triggers: skillResolved): Each ally the bearer uses a Helpful skill on gains Meltwater for 1 turn.

### `heal.glacier` — Glacial Spring
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15 and gains Meltwater for 1 turn.
- applies: meltwater · ops: heal, apply

### `bless.glacier` — Snowmelt
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally loses Icebound and Chilled, then gains Meltwater for 2 turns, +1 turn for each of those removed.
- applies: meltwater · ops: set, removeEffect, apply

### `curse.glacier` — Frozen in Time
- Curse · cost IW · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Icebound for 2 turns, so whatever skills they have on cooldown stay there until it ends; their cooldowns also rise by 1.
- applies: icebound · ops: apply, adjustCooldowns

### `smite.glacier` — Tidemark
- Smite · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each ally who damages them has their Renew heal once at once, without losing a stack.
- inline statuses: tidemark · ops: damage, apply, heal
  - inline `tidemark` (Debuff; triggers: damaged): Each of the applier's allies who damages the bearer has their Renew heal once.

### `prayer.glacier` — Stillfrost Hymn
- Prayer · cost Ir · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield for 1 turn. For 2 turns, Frostbitten enemies can't use Helpful skills either.
- applies: shield · inline statuses: stillfrost_hymn · ops: heal, apply
  - inline `stillfrost_hymn` (Debuff): While Frostbitten, the bearer can't use Helpful skills either.

### `cleave.glacier` — Calving
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. The next of their allies to use a skill before the user's next turn takes 20 damage.
- inline statuses: calving · ops: damage, apply, removeEffect
  - inline `calving` (Debuff; triggers: skillUsed): The first of these to use a skill takes 20 damage, and this ends on all of them.

### `shout.glacier` — Floe Horn
- Shout · cost I · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For 2 turns, at the end of each of the user's turns, each enemy takes 5 damage for each of their skills on cooldown (max 15).
- inline statuses: floe_horn · ops: apply, if, damage
  - inline `floe_horn` (Debuff; triggers: turnEnd): At the end of each of the applier's turns, the bearer takes 5 damage per skill of theirs on cooldown (max 15).

### `withstand.glacier` — Ice Shelf
- Withstand · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 2 turns, and Meltwater for as long as any of it remains.
- applies: meltwater · inline statuses: ice_shelf · ops: apply
  - inline `ice_shelf` (Buff): A Shield; the bearer has Meltwater while any of it remains.

### `taunt.glacier` — Rime Glare
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user until they next take direct damage, for up to 4 turns.
- applies: taunt · inline statuses: rime_glare · ops: apply, removeEffect
  - inline `rime_glare` (Debuff; triggers: damaged): The Taunt ends when the bearer takes direct damage.

### `titan.glacier` — Glacier Form
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Icebound, then Immune, and gains 1 Armor per skill of theirs on cooldown (max 3), rechecked as each hit lands.
- applies: icebound, immune · inline statuses: glacier_form · ops: apply
  - inline `glacier_form` (Buff): 1 Armor per skill on cooldown (max 3).

### `walrus_tusk` — Tusk (minion skill of `walrus_bull`)
- Minion · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy.
- ops: damage

### `walrus_haul_out` — Haul Out (minion skill of `walrus_bull`)
- Minion · cost r · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains Meltwater for 2 turns, and the Walrus is Icebound for as long.
- applies: meltwater, icebound · ops: apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `walrus_bull` — Walrus, 45 HP; skills: walrus_tusk, walrus_haul_out
- `ice_tongue` — Ice Tongue, 50 HP; skills: none
  - passive `ice_tongue_advance` (triggers: turnEnd): Does nothing for its first 2 turns; then, at the end of its owner's turns, deals 30 Piercing damage to a random enemy.

## Named statuses defined here (2) — this group owns their default animations

- `icebound` — Icebound (Debuff): The bearer's cooldowns don't tick down. _Applied by skills in: glacier._
- `meltwater` — Meltwater (Buff): The bearer's cooldowns tick down 1 extra at the end of each of their turns. _Applied by skills in: glacier._
