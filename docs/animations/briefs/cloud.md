# Cloud — animation brief

Group id: `cloud`. Element(s): Wind + Wind. Concept file: `docs/animations/concepts/cloud.yaml`.
Skill source: `packages/content/data/fusions/cloud/skills.cloud.yaml`; minions: `packages/content/data/fusions/cloud/minions.cloud.yaml`; statuses: `packages/content/data/fusions/cloud/statuses.cloud.yaml`.

## Skills (33)

### `strike.cloud` — Heavy Sky
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic, Drift
- Drift. Deals 35 damage to target enemy when it lands.
- ops: damage

### `smash.cloud` — Anvil Cloud
- Smash · cost Arr · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- At the start of the user's second turn from now, deals 50 damage to target enemy and 30 to each of their allies. It still lands if the user is Stunned, but is lost if they die.
- inline statuses: anvil_cloud · ops: apply, damage
  - inline `anvil_cloud` (Neutral): Lands on its target and their allies at the start of the user's second turn from now.

### `charge.cloud` — Rising Air
- Charge · cost free · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and the user gains Aloft for 2 turns. If they were already Aloft, the target's non-Strategic skills are stunned for 1 turn instead.
- applies: stun_ns, aloft · ops: damage, if, apply

### `riposte.cloud` — Cloud Veil
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user is Isolated for 1 turn, and the user gains Aloft for 2 turns. Invisible.
- applies: isolated, aloft · inline statuses: cloud_veil · ops: apply
  - inline `cloud_veil` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, Isolating its user.

### `rage.cloud` — Rise Above
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Aloft and gains 1 Might, and at the start of each of their turns, all their Debuffs are removed.
- applies: aloft, might · inline statuses: rise_above · ops: apply, removeKind
  - inline `rise_above` (Buff; triggers: turnStart): At the start of the bearer's turn, their Debuffs are removed.

### `shot.cloud` — Hailfall
- Shot · cost r · cooldown 1 · target **none** · tags Harmful, NonStrategic
- Deals 15 damage to every other unit on the field that isn't Leaping or Aloft, the user's allies included.
- ops: damage

### `snipe.cloud` — Squall Line
- Snipe · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- On the following turn, deals 30 Piercing damage to every enemy who used a Harmful skill in the meantime, and 15 to the rest. Channeled.
- applies: squall_marked · inline statuses: squall_watch, squall_line · ops: apply, forEach, if, damage, removeEffect
  - inline `squall_watch` (Debuff; triggers: skillUsed): If the bearer uses a Harmful skill, Squall Line deals them 30 Piercing damage instead of 15.
  - inline `squall_line` (Neutral): At the end of the following turn, unless interrupted, deals 30 Piercing damage to every enemy who used a Harmful skill meanwhile, and 15 to the rest.

### `trap.cloud` — Overcast
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, counts the skills target enemy uses. When it ends, 15 damage per skill they used Drifts onto them. Invisible.
- applies: drifting_hit · inline statuses: overcast · ops: apply, addStacksSelf, if
  - inline `overcast` (Debuff, hidden; triggers: skillUsed): When this ends, 15 damage per skill the bearer used during it Drifts onto them.

### `maneuver.cloud` — Idle Updraft
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn and begins Rushing. For 3 turns, their Rushing doesn't end after a turn with no skill used.
- applies: invulnerable, rushing, idle_updraft · ops: apply

### `companion.cloud` — Sky Whale
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Sky Whale (50 HP) permanently. Rain Down (r): Drift; when it lands, all allies heal 10. Breach (A): Drift; when it lands, 20 damage to all enemies.
- summons: sky_whale · ops: summon

### `bolt.cloud` — Cirrus Bolt
- Bolt · cost I · cooldown 1 · target **none** · tags Harmful, NonStrategic, Drift
- Drift. When it lands, deals 30 damage to the enemy with the least HP and Marks them for 1 turn.
- applies: mark · ops: damage, apply

### `blast.cloud` — Cloudburst
- Blast · cost Arr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, and 10 more Drifts onto each of them at the start of each of the user's next 2 turns.
- applies: drifting_hit · ops: damage, apply

### `consume.cloud` — Evaporate
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, and the user heals as much. Drift: at the start of the user's next turn, deals 15 more damage to them, and the user heals as much.
- inline statuses: evaporate · ops: damage, heal, apply
  - inline `evaporate` (Neutral): At the start of the bearer's next turn, deals 15 damage to its target, and the bearer heals as much.

### `summon.cloud` — Cloudlings
- Summon · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- Summons 2 Cloudlings (10 HP) for 3 turns. Drizzle (nc): Drift, 10 damage. When a Cloudling dies, all allies heal 10.
- inline statuses: cloudling_rain · summons: cloudling · ops: summon, apply, if, heal
  - inline `cloudling_rain` (Buff; triggers: signal): When one of the bearer's Cloudlings dies, all their allies heal 10.

### `channel.cloud` — Gathering Clouds
- Channel · cost AI · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Every enemy gains a Gathering Storm. For up to 3 turns, at the end of each of the user's turns, each Gathering Storm grows by 15. At the end of the user's third turn, each enemy takes damage equal to their Gathering Storm. Channeled.
- applies: gathering_storm · inline statuses: gathering_clouds · ops: apply, growShield
  - inline `gathering_clouds` (Neutral; triggers: turnEnd): At the end of each of the user's turns, every enemy's Gathering Storm grows by 15.

### `stab.cloud` — Sleet Needle
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, and 10 more damage Drifts onto them at the start of the user's next turn.
- applies: drifting_hit · ops: damage, apply

### `ravage.cloud` — Downburst
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- For 2 turns, the first time target enemy uses a Harmful skill, they take 35 Piercing damage. If they never do, they take 20 Piercing damage when it ends.
- inline statuses: downburst · ops: apply, damage
  - inline `downburst` (Debuff; triggers: skillUsed): The first Harmful skill the bearer uses deals them 35 Piercing damage; if they use none, they take 20 Piercing damage when this ends.

### `mislead.cloud` — Low Ceiling
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and for 2 turns they count as Immobile even if they have mobility skills or buffs. Invisible.
- applies: low_ceiling · inline statuses: low_ceiling_trap · ops: apply
  - inline `low_ceiling_trap` (Debuff, hidden; triggers: skillUsed/counter): The bearer's Harmful skills are countered, and they count as Immobile for 2 turns.

### `stun.cloud` — Sleet Squall
- Stun · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Drift
- Drift. When it lands, deals 10 damage to target enemy and each of their allies, and whichever enemy has the most HP is Stunned for 1 turn.
- applies: stun · ops: damage, apply

### `dance.cloud` — Sky Dancer
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 4 turns, the user is Aloft and gains 1 Focus. At the start of each of their turns, a random enemy loses their mobility buffs.
- applies: aloft, focus · inline statuses: sky_dancer · ops: apply, forEach, removeEffect
  - inline `sky_dancer` (Buff; triggers: turnStart): At the start of the bearer's turn, a random enemy loses their mobility buffs.

### `heal.cloud` — Rain Check
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15. For 1 turn, each hit they take is delayed and lands at the start of the user's next turn instead, 10 lower.
- inline statuses: rain_check · ops: heal, apply
  - inline `rain_check` (Buff): Each hit on the bearer is held and lands at the start of the healer's next turn, 10 lower.

### `bless.cloud` — Lift
- Bless · cost A · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Aloft for 2 turns. Any Taunt on them ends, and they can't be Taunted while Aloft.
- applies: aloft · inline statuses: lift · ops: removeEffect, apply, if
  - inline `lift` (Buff; triggers: effectGained): Can't be Taunted while Aloft.

### `curse.cloud` — Becalmed
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 2 turns, target enemy's skills Drift: each lands at the start of their next turn instead of when it's used.
- inline statuses: becalmed · ops: apply
  - inline `becalmed` (Debuff): The bearer's skills Drift, landing at the start of their next turn.

### `smite.cloud` — Silver Lining
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each ally who damages them loses a Debuff.
- inline statuses: silver_lining · ops: damage, apply, removeRandom
  - inline `silver_lining` (Debuff; triggers: damaged): Each enemy who damages the bearer loses a Debuff.

### `prayer.cloud` — Blessed Rain
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic, Drift
- Drift. When it lands, all allies heal 30 and gain 1 Swiftness.
- applies: swiftness · ops: heal, apply

### `cleave.cloud` — Gust Front
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy, and the user gains Aloft for 1 turn. If they were already Aloft, the second hit goes to the enemy with the least HP instead.
- applies: aloft · ops: damage, if, apply

### `shout.cloud` — Gale Warning
- Shout · cost A · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Each ally with Swiftness trades 1 of it to begin Rushing.
- applies: intimidated, rushing · ops: apply, forEach, removeStacks

### `withstand.cloud` — Cloudbank
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 2 turns. If it breaks while they're Rushing, they Leap.
- inline statuses: cloudbank, cloudbank_watch · macros: leap · ops: apply, if, forEach, macro
  - inline `cloudbank` (Buff): If this Shield breaks while the bearer is Rushing, they Leap.
  - inline `cloudbank_watch` (Neutral; triggers: ownEffectEnded): When the Cloudbank breaks while Rushing, the bearer Leaps.

### `taunt.cloud` — Looming Cloud
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. Each skill they use while Taunted Drifts 10 damage back onto them.
- applies: taunt, drifting_hit · inline statuses: looming_cloud · ops: apply, if
  - inline `looming_cloud` (Debuff; triggers: skillUsed): Each skill the bearer uses while Taunted drifts 10 damage back onto them next turn.

### `titan.cloud` — Cloud Titan
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune and Aloft; at the end of each of their turns, 15 damage Drifts onto the enemy who last damaged them.
- applies: immune, aloft, cloud_titan_mark, drifting_hit · inline statuses: cloud_titan · ops: apply, removeEffect
  - inline `cloud_titan` (Buff; triggers: damaged, turnEnd): At the end of the bearer's turn, 15 damage drifts onto the enemy who last damaged them.

### `whale_rain_down` — Rain Down (minion skill of `sky_whale`)
- Minion · cost r · cooldown 0 · target **allAllies** · tags Helpful, Strategic, Drift
- Drift. When it lands, all allies heal 10.
- ops: heal

### `whale_breach` — Breach (minion skill of `sky_whale`)
- Minion · cost A · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic, Drift
- Drift. When it lands, deals 20 damage to all enemies.
- ops: damage

### `cloudling_drizzle` — Drizzle (minion skill of `cloudling`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic, Drift
- Drift. Deals 10 damage to target enemy when it lands.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `sky_whale` — Sky Whale, 50 HP; skills: whale_rain_down, whale_breach
- `cloudling` — Cloudling, 10 HP; skills: cloudling_drizzle

## Named statuses defined here (7) — this group owns their default animations

- `aloft` — Aloft (Buff): Counts as Leaping (+5 direct damage, and Wind's Leaping payoffs) for its whole duration; dealing damage doesn't end it. It gives no Invulnerability. _Applied by skills in: cloud._
- `drifting_hit` — Drifting Damage (Neutral): When this runs out, the bearer takes its value as damage. _Applied by skills in: cloud._
- `gathering_storm` — Gathering Storm (Debuff): Grows while its Gathering Clouds channel lasts; when it runs out, the bearer takes its value as damage. _Applied by skills in: cloud._
- `idle_updraft` — Idle Updraft (Buff): The bearer's Rushing doesn't end after a turn with no skill used. _Applied by skills in: cloud._
- `low_ceiling` — Low Ceiling (Debuff): Counts as Immobile, whatever mobility skills or buffs the bearer has. _Applied by skills in: cloud._
- `squall_marked` — Squall-marked (Neutral): Used a Harmful skill during Squall Line, which deals the bearer 30 damage instead of 15. _Applied by skills in: cloud._
- `cloud_titan_mark` — Stormcloud (Neutral): The last enemy to damage a Cloud Titan. _Applied by skills in: cloud._
