# Ice — animation brief

Group id: `ice`. Element(s): Ice. Concept file: `docs/animations/concepts/ice.yaml`.
Skill source: `packages/content/data/ice/skills.ice.yaml`; minions: `packages/content/data/ice/minions.ice.yaml`; statuses: `packages/content/data/ice/statuses.ice.yaml`.

## Skills (33)

### `strike.ice` — Glacial Hammer
- Strike · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and afflicts them with Frostbitten for 2 turns.
- applies: frostbitten · ops: damage, apply

### `smash.ice` — Foot of the Mountain
- Smash · cost S · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies and Chills them for 2 turns.
- applies: chilled · ops: damage, apply

### `charge.ice` — Avalanche
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Numbs them for 2 turns.
- applies: numb · ops: damage, apply

### `riposte.ice` — Frost Spines
- Riposte · cost I · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user will counter any Harmful skill used on them. If a skill is countered this way, the user gains Frostborn for 3 turns. Invisible.
- applies: frostborn · inline statuses: frost_spines · ops: apply
  - inline `frost_spines` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; each counter grants 3 turns of Frostborn.

### `rage.ice` — Absolute Zero
- Rage · cost SI · cooldown 2 · target **none** · tags Harmful, Strategic
- Any character with Swiftness loses all Swiftness and is Stunned for 1 turn.
- applies: stun · ops: forEach, if, removeEffect, apply

### `shot.ice` — Icicle
- Shot · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Chills them for 1 turn.
- applies: chilled · ops: damage, apply

### `snipe.ice` — Comet Shard
- Snipe · cost AIr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user deals 50 Piercing damage to target enemy on the following turn. The target of this skill is invisible. Channeled. If the target is Chilled, this skill strikes instantly.
- inline statuses: comet_shard · ops: if, damage, apply
  - inline `comet_shard` (Neutral): Fires at the end of the following turn unless the user is stunned, dies or uses another skill.

### `trap.ice` — Frost Snare
- Trap · cost AI · cooldown 4 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, they will be Stunned for 2 turns. Invisible.
- applies: stun · inline statuses: frost_snare · ops: apply
  - inline `frost_snare` (Debuff, hidden; triggers: skillUsed): When the bearer uses a Harmful skill, they are Stunned for 2 turns.

### `maneuver.ice` — Glissade
- Maneuver · cost I · cooldown 5 · target **self** · tags Helpful, Strategic
- The user is Stunned, Invulnerable and Immune until the end of their next turn.
- applies: stun, invulnerable, immune · ops: apply

### `companion.ice` — Ice Bear
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Ice Bear minion (40 HP). Frostfang (S): 25 damage to target enemy and Chills them for 1 turn.
- summons: ice_bear · ops: summon

### `bolt.ice` — Icelance
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Numbs them for 1 turn. Against targets with no Buffs, deals 10 additional damage.
- applies: numb · ops: damage, apply

### `blast.ice` — Glacial Burst
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 30 damage to all enemies. Enemies without Buffs take 10 additional damage.
- ops: damage

### `consume.ice` — Siphon Frost
- Consume · cost r · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Chills them for 2 turns. The user gains Frostborn for 2 turns.
- applies: chilled, frostborn · ops: damage, apply

### `summon.ice` — Icy Familiar
- Summon · cost Ir · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons an Icy Familiar minion (35 HP) for 3 turns. Chilling Touch (I): 15 damage and Chilled for 2 turns. Frosty Breath (r): target enemy is Chilled through the next turn.
- summons: icy_familiar · ops: summon

### `channel.ice` — Blizzard
- Channel · cost I · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled
- At the end of each of the user's turns, deals 10 damage to target enemy and afflicts them with Frostbitten for 1 turn. If the user is Frostborn, this affects all enemies. Channeled.
- applies: frostbitten · inline statuses: blizzard · ops: apply, if, damage
  - inline `blizzard` (Neutral; triggers: turnEnd): Each end of the user's turn, 10 damage and 1 turn of Frostbitten to the target (all enemies if Frostborn). Lasts until interrupted.

### `stab.ice` — Piercing Cold
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and afflicts them with Frostbitten until the end of the user's next turn.
- applies: frostbitten · ops: damage, apply

### `ravage.ice` — Shardstorm
- Ravage · cost I · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to all enemies. Frostbitten enemies take 15 additional damage; the others are afflicted with Frostbitten for 1 turn.
- applies: frostbitten · ops: forEach, if, damage, apply

### `mislead.ice` — Iceform
- Mislead · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Frostborn for 1 turn. Any enemy who uses a Harmful skill on them during this time is Numbed for 2 turns before it lands.
- applies: frostborn, numb · inline statuses: iceform · ops: apply, if
  - inline `iceform` (Debuff; triggers: skillUsed): Using a Harmful skill on the Iceform user Numbs the bearer for 2 turns before it lands.

### `stun.ice` — Flash Freeze
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is afflicted with Frostbitten for 2 turns.
- applies: frostbitten · ops: apply

### `dance.ice` — Boreal Dance
- Dance · cost AI · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies, plus 10 for each Frost debuff they have. Enemies with no Frost debuffs are Chilled and Numbed for 1 turn.
- applies: chilled, numb · ops: forEach, damage, if, apply

### `heal.ice` — Freeze Wound
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Heals target ally for 10 health and grants them 2 Armor for 1 turn.
- applies: armor · ops: heal, apply

### `bless.ice` — Boreal Aegis
- Bless · cost I · cooldown 3 · target **ally** · tags Helpful, Strategic
- Target ally gains Frostborn until the end of their next turn, and all enemies are Chilled for 1 turn.
- applies: frostborn, chilled · ops: apply

### `curse.ice` — Hypothermia
- Curse · cost IW · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Frostbitten, Chilled, and Numb for 2 turns.
- applies: frostbitten, chilled, numb · ops: apply

### `smite.ice` — Chilling Grasp
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Numbs them for 1 turn.
- applies: numb · ops: damage, apply

### `prayer.ice` — Northern Solace
- Prayer · cost Ir · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- Heals all allies for 10 health and grants them 30 Shield and 2 Armor for 1 turn.
- applies: shield, armor · ops: heal, apply

### `cleave.ice` — Glacial Sweep
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If that enemy is affected by a Frost debuff, this skill also hits an additional random enemy.
- ops: set, damage, if

### `shout.ice` — Arctic Roar
- Shout · cost I · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- The enemy team is afflicted with Frostbitten until the end of the user's next turn.
- applies: frostbitten · ops: apply

### `withstand.ice` — Permafrost
- Withstand · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 2 turns. If the user is Frostborn, this Shield increases to 35.
- applies: shield · ops: apply

### `taunt.ice` — Cold Shoulder
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Frostbitten and Taunted for 1 turn.
- applies: frostbitten, taunt · ops: apply

### `titan.ice` — Frost Giant
- Titan · cost Sr · cooldown 3 · target **self** · tags Helpful, Strategic
- All enemies are Chilled for 2 turns. The user gains Frostborn for 1 turn for each 15 health they are missing (at least 1 turn).
- applies: chilled, frostborn · ops: apply

### `ice_bear_frostfang` — Frostfang (minion skill of `ice_bear`)
- Minion · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and Chills them for 1 turn.
- applies: chilled · ops: damage, apply

### `icy_familiar_touch` — Chilling Touch (minion skill of `icy_familiar`)
- Minion · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Chills them for 2 turns.
- applies: chilled · ops: damage, apply

### `icy_familiar_breath` — Frosty Breath (minion skill of `icy_familiar`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Chilled until the end of the next turn.
- applies: chilled · ops: apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `ice_bear` — Ice Bear, 40 HP; skills: ice_bear_frostfang
- `icy_familiar` — Icy Familiar, 35 HP; skills: icy_familiar_touch, icy_familiar_breath

## Named statuses defined here (4) — this group owns their default animations

- `frostbitten` — Frostbitten (Debuff): Unable to use Harmful Strategic skills. _Applied by skills in: apocalypse, crystal, lich, myth, night, prism, winter, ice._
- `chilled` — Chilled (Debuff): Unable to have skill costs reduced. _Applied by skills in: apocalypse, aurora, crystal, lich, myth, prism, stasis, winter, ice._
- `numb` — Numb (Debuff): Cannot apply Buffs (to anyone, including themselves). _Applied by skills in: apocalypse, ion, lich, myth, night, prism, ice._
- `frostborn` — Frostborn (Buff): Immune to Debuffs from Numb or Chilled units, and Invulnerable to Frostbitten units (they can't target or damage the bearer). _Applied by skills in: crystal, lich, winter, ice._
