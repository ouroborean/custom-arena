# Ocean — animation brief

Group id: `ocean`. Element(s): Water + Water. Concept file: `docs/animations/concepts/ocean.yaml`.
Skill source: `packages/content/data/fusions/ocean/skills.ocean.yaml`; minions: `packages/content/data/fusions/ocean/minions.ocean.yaml`; statuses: `packages/content/data/fusions/ocean/statuses.ocean.yaml`.

## Skills (32)

### `strike.ocean` — Breaker
- Strike · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Crest: deals 25 damage to target enemy, and they lose one of their Buffs. Trough: deals 15 damage, and the user loses one of their Debuffs.
- ops: if, damage, removeRandom

### `smash.ocean` — Rogue Wave
- Smash · cost Srr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Crest: deals 30 damage to target enemy and 15 to their allies. Trough: deals 15 damage to target enemy, and every enemy loses their Shield.
- ops: if, damage, removeShields

### `charge.ocean` — Swell
- Charge · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Crest: deals 15 damage, plus 5 for each of the user's turns since their last Trough (up to 20 more). Trough: deals 10 damage, and the user gains Flow until the end of their next turn.
- applies: flow · ops: if, set, damage, apply, setCounter

### `riposte.ocean` — Breakwater
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user. The user gains Brimming for 3 turns and 2 Renew per skill countered. Invisible.
- applies: brimming, renew · inline statuses: breakwater · ops: apply
  - inline `breakwater` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; each gives them Brimming and 2 Renew.

### `rage.ocean` — Relentless Surf
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might, and the first time they damage each Stunned enemy, that enemy's Stuns last 1 turn longer.
- applies: might · inline statuses: relentless_surf · ops: apply, extendEffects
  - inline `relentless_surf` (Buff; triggers: dealtDamage): The first time the bearer damages each Stunned enemy, that enemy's Stuns last 1 turn longer.

### `shot.ocean` — Spindrift
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user gains 2 Renew and Brimming for 2 turns. If they were already Brimming, they spend their Brimming Shield instead, dealing as much extra damage (up to 20).
- applies: renew, brimming · ops: if, set, damage, growShield, apply

### `snipe.ocean` — Harpoon
- Snipe · cost Ir · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- Crest: deals 45 damage to target enemy on the following turn. Trough: deals 30 damage on the following turn, and allies heal 30, split evenly between them. The target of this skill is invisible. Channeled.
- inline statuses: harpoon_crest, harpoon_trough · ops: if, apply, damage, heal
  - inline `harpoon_crest` (Neutral): Fires at the end of the following turn unless interrupted.
  - inline `harpoon_trough` (Neutral): Fires at the end of the following turn unless interrupted, and allies heal 30, split evenly.

### `trap.ocean` — Undercurrent
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns. Crest: each time target enemy uses a Harmful skill, they take 10 damage and their other cooldowns rise by 1. Trough: each time they use a Helpful skill, the user's ally with the least HP heals as much as it healed. Invisible.
- inline statuses: undercurrent_crest, undercurrent_trough · ops: if, apply, damage, adjustCooldowns, heal
  - inline `undercurrent_crest` (Debuff, hidden; triggers: skillUsed): Each Harmful skill the bearer uses deals them 10 damage and raises their other cooldowns by 1.
  - inline `undercurrent_trough` (Debuff, hidden; triggers: healDone): Each time the bearer heals someone, the applier's ally with the least HP heals as much.

### `maneuver.ocean` — Sounding
- Maneuver · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn and gains Flow for 2 turns. Each skill they use with Flow gives the ally with the least HP 2 Renew.
- applies: invulnerable, flow, renew · inline statuses: sounding · ops: apply, if
  - inline `sounding` (Buff; triggers: skillUsed): Each skill the bearer uses with Flow gives their ally with the least HP 2 Renew.

### `companion.ocean` — Kraken
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Kraken (40 HP) permanently. Tentacles (r): Crest: 15 damage. Trough: target enemy's non-Strategic skills are stunned for 1 turn.
- summons: kraken · ops: summon

### `bolt.ocean` — Brine Bolt
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Crest: deals 25 damage to target enemy, plus 5 for each stack of Renew on the user's side (up to 15 more). Trough: deals 15 damage, and every ally gains 2 Renew.
- applies: renew · ops: if, set, damage, apply

### `blast.ocean` — Flood Tide
- Blast · cost II · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. Every ally gains Brimming for 2 turns and 1 Renew for each enemy hit.
- applies: brimming, renew · ops: damage, set, apply

### `consume.ocean` — Ebbing Toll
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, and the user heals 5. The target gains 1 Confusion for 2 turns, and for as long, each skill they use while Confused heals the user 10 per Confusion they have.
- applies: confusion · inline statuses: ebbing_toll · ops: damage, heal, apply, if
  - inline `ebbing_toll` (Debuff; triggers: skillUsed): Each skill the bearer uses while Confused heals the applier 10 per Confusion.

### `summon.ocean` — Jellyfish Bloom
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons 3 Jellyfish (10 HP) for 3 turns. Stinging Bell (nc): 5 damage. When an enemy kills a Jellyfish, that enemy is Stunned for 1 turn.
- applies: stun · inline statuses: jellyfish_bloom · summons: jellyfish · ops: summon, apply, if
  - inline `jellyfish_bloom` (Buff; triggers: signal): An enemy who kills one of the bearer's Jellyfish is Stunned for 1 turn.

### `channel.ocean` — Slack Water
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, deals 10 damage to all enemies at the end of each of the user's turns. While it channels, allies' Renew doesn't lose stacks when it heals. Channeled.
- applies: slack_water_calm · inline statuses: slack_water · ops: apply, damage
  - inline `slack_water` (Neutral; triggers: turnEnd): Deals 10 damage to all enemies at the end of each of the user's turns.

### `stab.ocean` — Slipfoot Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. If they're Confused, they lose their Confusion and are Stunned for 1 turn.
- applies: stun · ops: damage, if, removeEffect, apply

### `ravage.ocean` — Breaker Swell
- Ravage · cost Ar · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 40 Piercing damage to target enemy and 15 to each of their allies. The user is Stunned on their next turn.
- applies: stun · ops: damage, apply

### `mislead.ocean` — Siren's Lure
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn. Crest: if target enemy uses a Harmful skill, it's countered and they're Taunted by the user for 2 turns. Trough: if they use a Helpful skill, it's countered and they're Stunned for 1 turn. Invisible.
- applies: taunt, stun · inline statuses: sirens_lure_crest, sirens_lure_trough · ops: if, apply
  - inline `sirens_lure_crest` (Debuff, hidden; triggers: skillUsed/counter): The bearer's Harmful skills are countered, and they're Taunted by the applier for 2 turns.
  - inline `sirens_lure_trough` (Debuff, hidden; triggers: skillUsed/counter): The bearer's Helpful skills are countered, and they're Stunned for 1 turn.

### `stun.ocean` — Maelstrom
- Stun · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Crest: deals 15 damage to target enemy and Stuns them for 1 turn. Trough: every Stunned enemy's Stuns last 1 turn longer, and every other enemy gains 1 Confusion for 2 turns.
- applies: stun, confusion · ops: if, damage, apply, forEach, extendEffects

### `dance.ocean` — Swell of the Deep
- Dance · cost Ar · cooldown 5 · target **self** · tags Helpful, Strategic
- For 4 turns, the user is Brimming, and once per turn, the first Debuff an enemy gives them is removed, and they gain 2 Renew for it.
- applies: brimming, renew · inline statuses: riding_the_swell · ops: apply, if, setCounter, eventEffect
  - inline `riding_the_swell` (Buff; triggers: effectGained): Once per turn, the first Debuff an enemy gives the bearer is removed, and they gain 2 Renew.

### `heal.ocean` — Tidepool
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 30. Any of it past their max HP becomes 2 Renew per 10, and they gain Brimming for 2 turns.
- applies: renew, brimming · ops: heal, apply

### `bless.ocean` — Swell and Break
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Crest: target ally gains Brimming for 3 turns and 15 Brimming Shield. Trough: target ally's Brimming Shield ends, and they gain 1 Might for 3 turns, plus 1 for every 10 Shield it held (up to 3 Might).
- applies: brimming, might · ops: if, apply, growShield, set, removeEffect

### `curse.ocean` — Brine Haze
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns. For as long, each time an ally of the user gains Renew, the target gains 1 more Confusion.
- applies: confusion · inline statuses: brine_haze · ops: apply
  - inline `brine_haze` (Buff; triggers: effectGained): Each time the bearer gains Renew, the Brine Haze target gains 1 more Confusion.

### `smite.ocean` — Foambreaker
- Smite · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, allies who damage them gain 2 Renew and Brimming for 2 turns.
- applies: renew, brimming · inline statuses: foambreaker · ops: damage, apply
  - inline `foambreaker` (Debuff; triggers: damaged): Enemies who damage the bearer gain 2 Renew and Brimming for 2 turns.

### `prayer.ocean` — Chorus of Tides
- Prayer · cost Irr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 30; healing past max HP becomes Shield, up to 30 each.
- ops: forEach, heal, if, growShield

### `cleave.ocean` — Crosscurrent
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Crest: deals 25 damage to target enemy and 15 to a random other enemy. Trough: deals 10 damage to target enemy and a random other enemy, and each also gains the other's Debuffs.
- ops: if, damage, shareEffects

### `shout.ocean` — Whalesong
- Shout · cost I · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- All enemies gain 1 Vulnerable for 2 turns. Every Invisible effect they own is revealed, and any they create in the next 2 turns is revealed as it's made.
- applies: vulnerable · inline statuses: whalesong · ops: apply, reveal
  - inline `whalesong` (Debuff; triggers: effectApplied): Every hidden effect the bearer applies is revealed.

### `withstand.ocean` — Returning Wave
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 30 Shield for 1 turn. When it ends, whatever is left of it is dealt as damage, split evenly among all enemies.
- inline statuses: returning_wave · ops: apply, damage
  - inline `returning_wave` (Buff): When it ends, the Shield left is dealt as damage to the enemies, split evenly.

### `taunt.ocean` — Riptide
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. Each Harmful skill they use while Taunted gives the user 2 Renew.
- applies: taunt, renew · inline statuses: riptide · ops: apply, if
  - inline `riptide` (Debuff; triggers: skillUsed): Each Harmful skill the bearer uses while Taunted gives the applier 2 Renew.

### `titan.ocean` — Leviathan Form
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Brimming, and at the end of each of their turns they deal 15 damage to the enemy with the least HP and gain 2 Renew.
- applies: armor, brimming, renew · inline statuses: leviathan_form · ops: apply, damage
  - inline `leviathan_form` (Buff; triggers: turnEnd): At the end of the bearer's turn, they deal 15 damage to the enemy with the least HP and gain 2 Renew.

### `kraken_tentacles` — Tentacles (minion skill of `kraken`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Crest: deals 15 damage to target enemy. Trough: target enemy's non-Strategic skills are stunned for 1 turn.
- applies: stun_ns · ops: if, damage, apply

### `jellyfish_stinging_bell` — Stinging Bell (minion skill of `jellyfish`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `kraken` — Kraken, 40 HP; skills: kraken_tentacles
- `jellyfish` — Jellyfish, 10 HP; skills: jellyfish_stinging_bell

## Named statuses defined here (4) — this group owns their default animations

- `brimming` — Brimming (Buff): Renew healing that would take the bearer above max HP becomes Shield instead, up to 30. _Applied by skills in: ocean._
- `brimming_shield` — Brimming Shield (Buff): Shield from Renew that overflowed (up to 30). _Applied by skills in: none directly._
- `slack_water_calm` — Slack Water (Buff): The bearer's Renew doesn't lose stacks when it heals. _Applied by skills in: ocean._
- `swell_of_the_deep` — Swell of the Deep (Buff): Each time Brimming gives the bearer Shield, they gain 1 Might for 1 turn. _Applied by skills in: none directly._
