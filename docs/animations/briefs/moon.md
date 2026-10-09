# Moon — animation brief

Group id: `moon`. Element(s): Earth + Shadow. Concept file: `docs/animations/concepts/moon.yaml`.
Skill source: `packages/content/data/fusions/moon/skills.moon.yaml`; minions: `packages/content/data/fusions/moon/minions.moon.yaml`; statuses: `packages/content/data/fusions/moon/statuses.moon.yaml`; macros: `packages/content/data/fusions/moon/macros.moon.yaml`.

## Skills (32)

### `strike.moon` — Moonstone Fist
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. New Moon: Stealthy. Waning: the user heals half the damage dealt.
- ops: damage, if, heal

### `smash.moon` — Moonfall
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and 10 to their allies, 5 more to each for every phase since the New Moon (Waning: 30 and 25). Then the user's Lunar Cycle falls back to New Moon.
- ops: set, damage, setCounter

### `charge.moon` — Prowl
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 10 damage to target enemy, and the user gains Stealth. Their Lunar Cycle holds this turn instead of advancing. Stealthy.
- applies: stealth, face_of_the_moon · ops: damage, apply

### `riposte.moon` — Shadowed Face
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. New Moon: it counters every Harmful skill used on them instead. Invisible.
- inline statuses: shadowed_face_new, shadowed_face · ops: if, apply
  - inline `shadowed_face_new` (Buff, hidden; triggers: skillTargeted/counter): Counters every Harmful skill used on the bearer.
  - inline `shadowed_face` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer.

### `rage.moon` — Turn Beast
- Rage · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user's Lunar Cycle moves to the Full Moon and holds there for 3 turns. For as long, their direct hits deal 10 more damage and heal them for half the damage dealt, but their Strategic skills are Stunned.
- applies: face_of_the_moon · inline statuses: turn_beast · ops: if, setCounter, signal, apply, heal
  - inline `turn_beast` (Buff; triggers: dealtDamage): +10 direct damage, and each direct hit heals the bearer for half the damage dealt; Strategic skills Stunned.

### `shot.moon` — Moonshard
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy. Waxing: they also take 15 more at the start of the next Full Moon.
- applies: moonshard · ops: damage, if, apply

### `snipe.moon` — Hunter's Moon
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- On the following turn, the user deals 30 damage to target enemy, 10 more for each hit the user's allies land on them before then (max 60). Channeled.
- inline statuses: hunted, hunters_moon · ops: apply, addStacksSelf, damage, removeEffect
  - inline `hunted` (Debuff; triggers: damaged): Each hit the applier's allies land on the bearer adds 10 damage to the Hunter's Moon (max 30 more).
  - inline `hunters_moon` (Neutral): When this runs out, its target takes 30 damage, +10 per hit the bearer's allies landed on them (max 60).

### `trap.moon` — Dreaming Stones
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time target enemy uses a Harmful skill, they fall Asleep and are Isolated for 1 turn. Invisible.
- applies: sleep, isolated · inline statuses: dreaming_stones · ops: apply
  - inline `dreaming_stones` (Debuff, hidden; triggers: skillUsed): The bearer's first Harmful skill puts them to Sleep and Isolates them.

### `maneuver.moon` — Eclipse
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Stealthy
- The user becomes Invulnerable for 1 turn, and the Lunar Cycle advances one extra phase at the end of the turn. Stealthy.
- applies: invulnerable · ops: apply, setCounter

### `companion.moon` — Lunar Wolf
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Lunar Wolf (35 HP) permanently. Moonfang (r): 10 Piercing damage. At the start of each Full Moon, it heals 20, and a random enemy is Taunted by it for 1 turn.
- summons: lunar_wolf · ops: summon

### `bolt.moon` — Moonless Bolt
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Blinded for 4 turns at the New Moon, 3 Waxing, 2 Full, or 1 Waning.
- applies: blinded · ops: damage, apply

### `blast.moon` — Moonburst
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Full Moon: Blinded ones fall Asleep after the hit. Waning: the user heals 5 per enemy hit.
- applies: sleep · ops: damage, if, apply, heal

### `consume.moon` — Drink the Moonlight
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, healing the user for the damage dealt. Waning: it hits every enemy instead.
- ops: if, set, forEach, damage, heal

### `summon.moon` — Moon Moths
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons 2 Moon Moths (10 HP) for 3 turns, and every Blinded enemy is Taunted by one for 1 turn. Flutter (r): 10 damage to target enemy.
- applies: taunt · summons: moon_moth · ops: summon, apply

### `channel.moon` — Lunar Lullaby
- Channel · cost Wr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Until the next New Moon, deals 10 damage to all enemies at the end of each of the user's turns. If it lasts to the New Moon, every enemy falls Asleep. Channeled.
- applies: sleep · inline statuses: lunar_lullaby · ops: apply, damage, removeSelf
  - inline `lunar_lullaby` (Neutral; triggers: turnEnd, signal): Each turn, 10 damage to all enemies; at the New Moon, every enemy falls Asleep.

### `stab.moon` — Silver Severance
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 at or below 60 HP. Their Blind ends, and they're Isolated for 2 turns instead.
- applies: isolated · ops: damage, if, removeEffect, apply

### `ravage.moon` — Feral Maw
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 Piercing damage to target enemy, then the user is Blinded through their next turn.
- applies: blinded · ops: damage, apply

### `mislead.moon` — False Moonlight
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and every enemy is Blinded for 1 turn. Invisible.
- applies: blinded · inline statuses: false_moonlight · ops: apply
  - inline `false_moonlight` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and every unit of their side is Blinded.

### `stun.moon` — Lunacy
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, then they and a random ally of theirs fall Asleep for 1 turn, and damage that wakes either one wakes both.
- applies: shared_dream, sleep · ops: damage, apply

### `dance.moon` — Dance of Phases
- Dance · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- For 2 turns, the user gains 1 Swiftness and, by phase: New, Stealth; Waxing, 2 Armor; Full, 2 Might; Waning, 2 Renew.
- applies: swiftness, stealth, armor, might, renew · ops: apply, if

### `heal.moon` — Borrowed Moonlight
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 40. 3 turns later, they lose 20 HP, which can't kill them.
- inline statuses: borrowed_moonlight · ops: heal, apply, damage
  - inline `borrowed_moonlight` (Neutral): When this runs out, the bearer loses 20 HP (never below 1).

### `bless.moon` — Moonveil
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally is Asleep and Invulnerable through their next turn. When they wake, they gain 2 Might for 2 turns and 3 Renew.
- applies: invulnerable, sleep, might, renew · inline statuses: moonveil · ops: apply, removeEffect
  - inline `moonveil` (Buff): When this ends, the bearer wakes with 2 Might for 2 turns and 3 Renew.

### `curse.moon` — Tidal Lock
- Curse · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 3 turns, target enemy's skills are Stunned in alternation: non-Strategic ones on their first and third turns, Strategic ones on their second.
- applies: stun_s, stun_ns · inline statuses: tidal_lock · ops: apply, if, addStacksSelf
  - inline `tidal_lock` (Debuff; triggers: turnEnd): Non-Strategic skills Stunned on the bearer's first and third turns, Strategic ones on the second.

### `smite.moon` — Moonlight Covenant
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, every unit on both sides is Sanctified.
- applies: sanctify · ops: damage, apply

### `prayer.moon` — Lunar Hymn
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. New Moon: they gain Stealth. Waxing: 2 Renew. Full: 1 Might for 2 turns. Waning: every enemy gains 1 Weakness.
- applies: stealth, renew, might, weakness · ops: heal, if, apply

### `cleave.moon` — Shattered Crescent
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and each other enemy gains a Moonshard: 15 damage at the start of the next Full Moon.
- applies: moonshard · ops: damage, apply

### `shout.moon` — Howl at the Moon
- Shout · cost Wr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- The user heals 20, and every enemy is Taunted by them for 1 turn.
- applies: taunt · ops: heal, apply

### `withstand.moon` — Cairn Ward
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. When it ends, the user creates a Boulder with HP equal to what's left of it.
- inline statuses: cairn_ward · summons: boulder · ops: apply, if, set, summon, damage
  - inline `cairn_ward` (Buff): Absorbs damage; when it runs out, the bearer creates a Boulder with HP equal to what's left.

### `taunt.moon` — Wandering Light
- Taunt · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. Each time an ally of the user damages them, the Taunt passes to that ally.
- applies: taunt · inline statuses: wandering_light · ops: apply, removeEffect
  - inline `wandering_light` (Debuff; triggers: damaged): Each direct hit from the applier's side passes the bearer's Taunt to the hitter.

### `titan.moon` — Face of the Moon
- Titan · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, each enemy who hits the user is Blinded for 2 turns, and deals them 10 less damage while Blinded.
- applies: blinded, moonglare · inline statuses: face_of_the_moon_glare · ops: apply
  - inline `face_of_the_moon_glare` (Buff; triggers: damaged): Each enemy who hits the bearer is Blinded for 2 turns, and deals them 10 less damage while Blinded.

### `wolf_moonfang` — Moonfang (minion skill of `lunar_wolf`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy.
- ops: damage

### `moth_flutter` — Flutter (minion skill of `moon_moth`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `lunar_wolf` — Lunar Wolf, 35 HP; skills: wolf_moonfang
- `moon_moth` — Moon Moth, 10 HP; skills: moth_flutter

## Named statuses defined here (6) — this group owns their default animations

- `lunar_cycle` — Lunar Cycle (Neutral; triggers: turnEnd): Starts at New Moon and advances at the end of each of this character's turns: New, Waxing, Full, Waning. Moon skills add the current phase's rider. _Applied by skills in: none directly._
- `moonshard` — Moonshard (Debuff; triggers: signal): At the start of the next Full Moon, the bearer takes 15 damage. _Applied by skills in: moon._
- `wolf_howl` — Howl (Neutral; triggers: signal): At each Full Moon, heals 20 and Taunts a random enemy for 1 turn. _Applied by skills in: none directly._
- `face_of_the_moon` — Held Moon (Buff): The bearer's Lunar Cycle holds at its current phase. _Applied by skills in: moon._
- `shared_dream` — Shared Dream (Debuff; triggers: damaged): Damage that wakes the bearer also wakes everyone else with the same Shared Dream. _Applied by skills in: moon._
- `moonglare` — Moonglare (Debuff): While Blinded, the bearer deals 10 less direct damage to a unit under the Face of the Moon. _Applied by skills in: moon._

## Macros defined here (1) — this group owns their default animations

- `advance_moon`: ops setCounter, if, signal. _Used by: none directly._
