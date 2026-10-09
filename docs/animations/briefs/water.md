# Water — animation brief

Group id: `water`. Element(s): Water. Concept file: `docs/animations/concepts/water.yaml`.
Skill source: `packages/content/data/water/skills.water.yaml`; minions: `packages/content/data/water/minions.water.yaml`; statuses: `packages/content/data/water/statuses.water.yaml`.

## Skills (32)

### `strike.water` — Flowing Fist
- Strike · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and gives the user 2 Renew.
- applies: renew · ops: damage, apply

### `smash.water` — Waterfall
- Smash · cost Srr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy and 10 damage to the others. Reduces the remaining cooldown of all the user's other skills by 1.
- ops: damage, adjustCooldowns

### `charge.water` — Surge
- Charge · cost I · cooldown 2 · target **ally** · tags Helpful, Strategic
- Gives target ally 2 Renew, and the next time the user applies Renew, they apply 2 more.
- applies: renew · inline statuses: surge · ops: apply
  - inline `surge` (Buff): The bearer's next Renew applies 2 extra stacks.

### `riposte.water` — Riverbend
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user will counter any Strategic skill used on them. If triggered, the user gains Flow. Invisible.
- applies: flow · inline statuses: riverbend · ops: apply
  - inline `riverbend` (Buff, hidden; triggers: skillTargeted/counter): Counters Strategic skills used on the bearer; each counter grants Flow.

### `rage.water` — Quiet Fury
- Rage · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Flow, 1 Might, and 1 Focus.
- applies: flow, might, focus · ops: apply

### `shot.water` — Coordinated Shot
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Marks them. If they were already Marked, the user gains Flow.
- applies: mark, flow · ops: set, damage, apply, if

### `snipe.water` — Tidal Arrow
- Snipe · cost Ir · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user deals 40 damage to target enemy on the following turn, then gains Flow. The target of this skill is invisible. Channeled.
- applies: flow · inline statuses: tidal_arrow · ops: apply, damage
  - inline `tidal_arrow` (Neutral): Fires at the end of the following turn unless the user is stunned, dies or uses another skill; then the user gains Flow.

### `trap.water` — Whirlpool Trap
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 2 turns, each time target enemy uses a Strategic skill, they gain 1 Confusion.
- applies: confusion · inline statuses: whirlpool · ops: apply
  - inline `whirlpool` (Debuff; triggers: skillUsed): Each Strategic skill the bearer uses gives them 1 Confusion.

### `maneuver.water` — Dive
- Maneuver · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn and gains 2 Renew.
- applies: invulnerable, renew · ops: apply

### `companion.water` — Rainbow Scale Fish
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Rainbow Scale Fish minion (35 HP). Shimmer (r): target ally gains 2 Renew; then, if they have 3 or more Renew, they gain Flow for 3 turns.
- summons: rainbow_scale_fish · ops: summon

### `bolt.water` — Splash
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and gives a random ally 2 Renew.
- applies: renew · ops: damage, apply

### `blast.water` — Deluge
- Blast · cost II · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies. If the user has Flow, it is consumed to also stun their non-Strategic skills for 1 turn; otherwise, the user gains Flow.
- applies: stun_ns, flow · ops: set, damage, if, removeEffect, apply

### `consume.water` — Drink Deeply
- Consume · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Removes all Renew from allied units to heal target ally 10 HP for each stack removed. If there was none, the target gains 3 Renew instead.
- applies: renew · ops: set, if, removeEffect, heal, apply

### `summon.water` — Water Elemental
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Water Elemental minion (15 HP) for 3 turns. Lashing Water (no cost): 10 damage to target enemy, Uncounterable.
- summons: water_elemental · ops: summon

### `channel.water` — Call Rain
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- The user channels for up to 4 turns. Each turn, they deal 5 damage to all enemies and give all allies 1 Renew.
- applies: renew · inline statuses: call_rain · ops: apply, damage
  - inline `call_rain` (Neutral; triggers: turnEnd): Each end of the user's turn, 5 damage to all enemies and 1 Renew to all allies.

### `stab.water` — Shell Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, increased to 25 if the user has at least 3 stacks of Renew; otherwise, the user gains 2 Renew.
- applies: renew · ops: if, signal, damage, apply

### `ravage.water` — Drown
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. Against Stunned targets, extends their active Stuns by 1 turn.
- ops: damage, extendEffects

### `mislead.water` — Dunk
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy attempts to use a Helpful skill, they will be countered and gain 1 Confusion. Invisible.
- applies: confusion · inline statuses: dunk · ops: apply
  - inline `dunk` (Debuff, hidden; triggers: skillUsed/counter): The bearer's Helpful skills are countered; each counter gives them 1 Confusion.

### `stun.water` — Undertow
- Stun · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Stuns them for 1 turn. If the target is already Stunned, instead extends the duration of those Stuns by 1 turn.
- applies: stun · ops: set, damage, if, extendEffects, apply

### `dance.water` — Pull of the River
- Dance · cost Ir · cooldown 5 · target **self** · tags Helpful, Strategic
- The user gains Flow for 4 turns, 3 Renew, and 1 Swiftness.
- applies: flow, renew, swiftness · ops: apply

### `heal.water` — Renewing Spring
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally gains 4 Renew.
- applies: renew · ops: apply

### `bless.water` — Touch of Grace
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Flow for 3 turns.
- applies: flow · ops: apply

### `curse.water` — Airless Helm
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Target enemy receives 10 Affliction damage and 3 Weakness for 1 turn.
- applies: weakness · ops: damage, apply

### `smite.water` — Aqua Ring
- Smite · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 2 turns, allies that damage that enemy gain Flow for 3 turns.
- applies: flow · inline statuses: aqua_ring · ops: damage, apply
  - inline `aqua_ring` (Debuff; triggers: damaged): Units on the applier's side that deal direct damage to the bearer gain Flow for 3 turns.

### `prayer.water` — Rainsong
- Prayer · cost Irr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- Heals all allies for 15 health and grants them 3 Renew.
- applies: renew · ops: heal, apply

### `cleave.water` — Water Lash
- Cleave · cost S · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies. If the user has Flow, damaged targets receive 1 Weakness.
- applies: weakness · ops: damage, if, apply

### `shout.water` — Whale Call
- Shout · cost I · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- All enemies gain 1 Vulnerable. Stunned or Taunted enemies also take 15 Affliction damage.
- applies: vulnerable · ops: apply, forEach, if, damage

### `withstand.water` — Aqua Veil
- Withstand · cost r · cooldown 1 · target **self** · tags Helpful, Strategic
- The user gains 10 Shield for 1 turn and 2 Renew.
- applies: shield, renew · ops: apply

### `taunt.water` — Tidal Pull
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 3 turns. The cooldown of this skill resets if the user gains Flow while it is on cooldown.
- applies: taunt · inline statuses: tidal_pull_reset · ops: apply, resetCooldown
  - inline `tidal_pull_reset` (Neutral; triggers: effectGained): When the bearer gains Flow, Tidal Pull comes off cooldown.

### `titan.water` — Naiad Form
- Titan · cost WW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 2 Armor, 2 Renew, and 1 Might.
- applies: armor, renew, might · ops: apply

### `fish_shimmer` — Shimmer (minion skill of `rainbow_scale_fish`)
- Minion · cost r · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains 2 Renew. Then, if they have 3 or more Renew, they gain Flow for 3 turns.
- applies: renew, flow · ops: apply, if

### `elemental_lashing_water` — Lashing Water (minion skill of `water_elemental`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic, Uncounterable
- Deals 10 damage to target enemy. Uncounterable.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `rainbow_scale_fish` — Rainbow Scale Fish, 35 HP; skills: fish_shimmer
- `water_elemental` — Water Elemental, 15 HP; skills: elemental_lashing_water

## Named statuses defined here (1) — this group owns their default animations

- `flow` — Flow (Buff): The bearer's skills ignore counters and reflects. _Applied by skills in: anointment, ocean, water._
