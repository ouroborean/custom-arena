# Earth — animation brief

Group id: `earth`. Element(s): Earth. Concept file: `docs/animations/concepts/earth.yaml`.
Skill source: `packages/content/data/earth/skills.earth.yaml`; minions: `packages/content/data/earth/minions.earth.yaml`; macros: `packages/content/data/earth/macros.earth.yaml`.

## Skills (34)

### `strike.earth` — Worldfist
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, +5 for each allied minion.
- ops: damage

### `smash.earth` — Worldquake
- Smash · cost rrr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and 10 to its allies. Costs 1 GEN less per allied minion.
- ops: damage

### `charge.earth` — Rolling Crash
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and creates a Boulder minion (45 HP).
- summons: boulder · ops: damage, summon

### `riposte.earth` — Shale Guard
- Riposte · cost r · cooldown 1 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user counters the first Harmful skill used on them, dealing 10 Piercing damage to its user. Invisible.
- inline statuses: shale_guard · ops: apply, damage
  - inline `shale_guard` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, dealing 10 Piercing damage to its user.

### `rage.earth` — Nature's Wrath
- Rage · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user creates 2 Seedling minions, then gains Immune for 2 turns.
- applies: immune · summons: seedling · ops: summon, apply

### `shot.earth` — Launch Stone
- Shot · cost r · cooldown 0 · target **any** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. Can instead target an allied Boulder, launching it at a random enemy for damage equal to its remaining HP; this destroys the Boulder.
- macros: launch_boulder · ops: if, damage, forEach, macro

### `snipe.earth` — Tunnelmaker
- Snipe · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- In 2 turns, the user deals 65 damage to target enemy. If the user has a Boulder, one is consumed to make it land a turn sooner. Channeled.
- inline statuses: tunnelmaker · ops: set, if, kill, apply, damage
  - inline `tunnelmaker` (Neutral): When it runs out, 65 damage to the target, unless interrupted.

### `trap.earth` — Boulder Trap
- Trap · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 2 turns, whenever target enemy creates a minion, that minion is destroyed and the user creates a Boulder minion instead.
- inline statuses: boulder_trap · summons: boulder · ops: apply, kill, summon
  - inline `boulder_trap` (Debuff; triggers: summoned): Minions the bearer creates are destroyed, and the trapper creates a Boulder instead.

### `maneuver.earth` — Burrow
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable and Ghosted for 1 turn.
- applies: invulnerable, ghosted · ops: apply

### `companion.earth` — Forest Stalker
- Companion · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Forest Stalker minion (50 HP, counts as a Seedling). Rootlash (no cost): 10 Piercing damage to target enemy. Channel Earth (r): its creator gains 1 Might and 1 Armor.
- summons: forest_stalker · ops: summon

### `bolt.earth` — Vine Lash
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If the user has no Seedling minions, they create one.
- summons: seedling · ops: damage, if, summon

### `blast.earth` — Verdant Burst
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Channel Growth, then deal 25 damage to all enemies.
- macros: channel_growth · ops: macro, damage

### `consume.earth` — Worldmarch
- Consume · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- Sacrifices all allied Seedling minions and creates that many Worldsprout minions. If there were none, the user creates 2 Seedling minions instead.
- summons: worldsprout, seedling · ops: set, if, kill, repeat, summon

### `summon.earth` — Sprout Seedling
- Summon · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons 2 Seedling minions (15 HP). Channel Earth (r): its creator gains 1 Might and 1 Armor.
- summons: seedling · ops: summon

### `channel.earth` — Worldcaller
- Channel · cost Ir · cooldown 3 · target **self** · tags Helpful, Strategic, Channeled
- Creates a Worldsprout minion (35 HP) at the end of each of the user's turns, for 4 turns. Treant Smash (no cost): 10 damage. Vitality Transfer (no cost): sacrifices the Worldsprout to heal target ally for its current HP. Channeled.
- inline statuses: worldcaller · summons: worldsprout · ops: apply, summon
  - inline `worldcaller` (Neutral; triggers: turnEnd): Each end of the user's turn, a Worldsprout is created.

### `stab.earth` — Stonepierce
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, increased to 20 against targets with Shield or Armor.
- ops: if, signal, damage

### `ravage.earth` — Stone Drill
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, +20 if the user has at least 3 total Armor and Might.
- ops: damage

### `mislead.earth` — Pitfall
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 1 turn, if target enemy uses a Harmful skill, it is countered and they are Stunned and Isolated for 1 turn.
- applies: stun, isolated · inline statuses: pitfall · ops: apply
  - inline `pitfall` (Debuff; triggers: skillUsed/counter): The bearer's Harmful skills are countered, and each counter Stuns and Isolates them for 1 turn.

### `stun.earth` — Earthwrap
- Stun · cost Wr · cooldown 4 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 25 Shield and is Stunned for 2 turns.
- applies: shield, stun · ops: apply

### `dance.earth` — Landslide
- Dance · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- The user gains 10 Shield. If they already had Shield from Landslide, they also create a Boulder minion.
- inline statuses: landslide · summons: boulder · ops: set, apply, if, summon
  - inline `landslide` (Buff): A Shield. Using Landslide again while it holds creates a Boulder.

### `heal.earth` — Grovetender
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Channel Growth, then heal target ally for 15 HP.
- macros: channel_growth · ops: macro, heal

### `bless.earth` — Infuse Earth
- Bless · cost free · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Might or 1 Armor, chosen at random.
- applies: might, armor · ops: random, apply

### `curse.earth` — Worldmute
- Curse · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Might for 4 turns. Then, for each Might they have, a random enemy gains 1 Weakness.
- applies: might, weakness · ops: apply, repeat

### `smite.earth` — Earth Pillar
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, if a Boulder damages them, they are Stunned for 1 turn.
- applies: stun · inline statuses: earth_pillar · ops: damage, apply, if
  - inline `earth_pillar` (Debuff; triggers: damaged): If a Boulder damages the bearer, they are Stunned for 1 turn.

### `prayer.earth` — Verse of Nurturing
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- Channel Growth twice, then heal all allies for 25 HP and give them 2 Renew.
- applies: renew · macros: channel_growth · ops: macro, heal, apply

### `cleave.earth` — Vine Whirl
- Cleave · cost W · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 5 damage to all enemies. If there's an allied Boulder, a random one is launched (as Launch Stone); otherwise, the user creates a Boulder minion.
- macros: launch_boulder · summons: boulder · ops: set, damage, if, forEach, macro, summon

### `shout.earth` — Awakener's Roar
- Shout · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user creates a Boulder minion. Then all allied Boulder minions gain 1 Armor and are healed to full HP.
- applies: armor · summons: boulder · ops: summon, forEach, apply, heal

### `withstand.earth` — Rampart
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 30 Shield. If the user already has Shield, they instead double their current Shield.
- applies: shield · ops: if, scaleShields, apply

### `taunt.earth` — Ancient Grudge
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Permanently Taunts target enemy. Only one enemy can have Ancient Grudge at a time.
- inline statuses: ancient_grudge · ops: removeEffect, apply
  - inline `ancient_grudge` (Debuff): Permanently Taunted by the user.

### `titan.earth` — Treant Form
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user creates a Seedling and a Boulder minion. Then, for 4 turns, they gain 1 Might per allied Seedling and 5 Shield per allied Boulder.
- applies: might, shield · summons: seedling, boulder · ops: summon, apply, set, if

### `seedling_channel_earth` — Channel Earth (minion skill of `seedling`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- This minion's creator gains 1 Might and 1 Armor.
- applies: might, armor · ops: apply, signal

### `stalker_rootlash` — Rootlash (minion skill of `forest_stalker`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy.
- ops: damage

### `worldsprout_treant_smash` — Treant Smash (minion skill of `worldsprout`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

### `worldsprout_vitality_transfer` — Vitality Transfer (minion skill of `worldsprout`)
- Minion · cost free · cooldown 0 · target **ally** · tags Helpful, Strategic
- Sacrifices the Worldsprout to heal target ally for its current HP.
- ops: set, kill, heal

## Minions (4)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `boulder` — Boulder, 45 HP; skills: none
- `seedling` — Seedling, 15 HP; skills: seedling_channel_earth
- `forest_stalker` — Forest Stalker, 50 HP; skills: stalker_rootlash, seedling_channel_earth
- `worldsprout` — Worldsprout, 35 HP; skills: worldsprout_treant_smash, worldsprout_vitality_transfer

## Macros defined here (2) — this group owns their default animations

- `channel_growth`: ops forEach, addMaxHp, heal. _Used by: earth, life._
- `launch_boulder`: ops set, damage, kill. _Used by: earth._
