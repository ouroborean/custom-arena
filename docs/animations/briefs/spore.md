# Spore — animation brief

Group id: `spore`. Element(s): Poison + Earth. Concept file: `docs/animations/concepts/spore.yaml`.
Skill source: `packages/content/data/fusions/spore/skills.spore.yaml`; minions: `packages/content/data/fusions/spore/minions.spore.yaml`; statuses: `packages/content/data/fusions/spore/statuses.spore.yaml`; macros: `packages/content/data/fusions/spore/macros.spore.yaml`.

## Skills (32)

### `strike.spore` — Moldering Fist
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 1 Spore. If a Mushroom sprouts from them, the user also gains 1 Might and 1 Armor for good.
- applies: spores, might, armor · ops: set, damage, apply, if

### `smash.spore` — Puffball Stomp
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If they have Spores, they lose them, and each of their allies gains that many.
- applies: spores · ops: damage, set, if, removeEffect, apply

### `charge.spore` — Spore Trail
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains 1 Spore. Through the user's next turn, each enemy their skills damage gains 1 Spore.
- applies: spores · inline statuses: spore_trail · ops: damage, apply
  - inline `spore_trail` (Buff; triggers: dealtDamage): Each enemy the bearer's skills damage gains 1 Spore.

### `riposte.spore` — Bursting Cap
- Riposte · cost W · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user gains 1 Spore per target the skill had. Invisible.
- applies: spores · inline statuses: bursting_cap · ops: apply
  - inline `bursting_cap` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user gains 1 Spore per target the skill had.

### `rage.spore` — Amanita Frenzy
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Blinded, so their single-target skills land on a random enemy, and gains 3 Might and Immune.
- applies: blinded, might, immune · ops: apply

### `shot.spore` — Fester Pod
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy, who gains 1 Spore, or 2 if they already had Spores.
- applies: spores · ops: set, damage, apply

### `snipe.spore` — Root Rot
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- In 2 turns, deals 50 damage to target enemy and 15 to each of their allies with Spores. The target of this skill is invisible. Channeled.
- inline statuses: root_rot · ops: apply, damage
  - inline `root_rot` (Neutral): When this runs out, its target takes 50 damage and their allies with Spores 15.

### `trap.spore` — Tainted Hands
- Trap · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, each time target enemy uses a Helpful skill, they and every ally it affects gain 1 Spore. Invisible.
- applies: spores · inline statuses: tainted_hands · ops: apply
  - inline `tainted_hands` (Debuff, hidden; triggers: skillResolved): Each Helpful skill the bearer uses gives them and every ally it affects 1 Spore.

### `maneuver.spore` — Spore Molt
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn and loses their Debuffs; for each one lost, a random enemy gains 1 Spore.
- applies: invulnerable, spores · ops: apply, set, removeKind, repeat

### `companion.spore` — Sporeling
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Sporeling (40 HP, counts as a Seedling) permanently. Infecting Lash (r): 10 damage and 1 Spore. It gains 10 max HP and heals 10 whenever a Mushroom sprouts for its side.
- summons: sporeling · ops: summon

### `bolt.spore` — Binding Hypha
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and links them to a random ally of theirs for 2 turns: whenever either of them takes direct damage, the other gains 1 Spore.
- applies: spores · inline statuses: binding_hypha · ops: damage, forEach, apply
  - inline `binding_hypha` (Debuff; triggers: damaged): Whenever the bearer takes direct damage, the unit linked to them gains 1 Spore.

### `blast.spore` — Sporestorm
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Every allied Seedling, Mushrooms included, Puffs, giving a random enemy 1 Spore; then deals 25 damage to all enemies.
- applies: spores · ops: forEach, apply, damage

### `consume.spore` — Decompose
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. If they have Spores, they lose them, and the user heals 10 per Spore lost; if not, they gain 2 Spores.
- applies: spores · ops: set, damage, if, removeEffect, heal, apply

### `summon.spore` — Bloater
- Summon · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Bloater (20 HP) for 3 turns. Rancid Spit (r): 10 damage. When the Bloater dies, every enemy gains 1 Spore.
- summons: bloater · ops: summon

### `channel.spore` — Mycelial Network
- Channel · cost Wr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic, Channeled
- For 4 turns, at the end of each of the user's turns, every enemy with Spores gains 1 more; if none has any, a random enemy gains 1. Channeled.
- applies: spores · inline statuses: mycelial_network · ops: apply, if
  - inline `mycelial_network` (Neutral; triggers: turnEnd): Each turn, every enemy with Spores gains 1 more; if none has any, a random enemy gains 1.

### `stab.spore` — Thorn of Rot
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- First, if target enemy has Armor, they lose 1 Armor and gain 1 Vulnerable; then deals them 10 Piercing damage, or 15 if they already had Spores, and they gain 1 Spore.
- applies: vulnerable, spores · ops: if, removeStacks, apply, damage

### `ravage.spore` — Rot Drill
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. If they have Spores, they lose them, and the user gains 1 Might and 1 Armor for 3 turns. If not, they gain 2 Spores.
- applies: might, armor, spores · ops: damage, if, removeEffect, apply

### `mislead.spore` — Soft Ground
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered: they're Stunned for 1 turn if they carry Spores, or gain 2 Spores if they don't. Invisible.
- applies: stun, spores · inline statuses: soft_ground · ops: apply, if
  - inline `soft_ground` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they're Stunned for 1 turn if they carry Spores, or gain 2 Spores if they don't.

### `stun.spore` — Fungal Shroud
- Stun · cost Ar · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn and gains 1 Spore. If they have 2 or more Spores when it ends, a Mushroom sprouts from them.
- applies: stun, spores · inline statuses: fungal_shroud · macros: sprout · ops: apply, if, removeEffect, macro
  - inline `fungal_shroud` (Debuff): When this ends, if the bearer has 2 or more Spores, a Mushroom sprouts from them.

### `dance.spore` — Rooted Rhythm
- Dance · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus. Whenever they or one of their minions takes damage meanwhile, it heals 5 and the user gains 1 Armor for 1 turn.
- applies: swiftness, focus, armor · inline statuses: rooted_rhythm · ops: apply, heal
  - inline `rooted_rhythm` (Buff; triggers: damaged): When the bearer takes damage, it heals 5 and the applier gains 1 Armor for 1 turn.

### `heal.spore` — Compost Bed
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20 and loses 1 random Debuff; if they lose one, a random enemy gains 1 Spore.
- applies: spores · ops: heal, if, removeRandom, apply

### `bless.spore` — Mycorrhizal Bond
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally and the user each gain 1 Might, and whenever an enemy damages one of them, the other gains 1 Armor for 1 turn.
- applies: armor, might · inline statuses: mycorrhizal_bond, mycorrhizal_bond_root · ops: apply, if
  - inline `mycorrhizal_bond` (Buff; triggers: damaged): Whenever an enemy damages the bearer, the applier gains 1 Armor for 1 turn.
  - inline `mycorrhizal_bond_root` (Buff; triggers: damaged): Whenever an enemy damages the bearer, the bonded ally gains 1 Armor for 1 turn.

### `curse.spore` — Infest
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 2 Spores. For 2 turns, every enemy carrying Spores pays 1 more for their skills.
- applies: spores, infest · ops: apply

### `smite.spore` — Cordyceps Brand
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, half of all healing they receive goes to a random ally of the user instead.
- inline statuses: cordyceps_brand · ops: damage, apply, heal
  - inline `cordyceps_brand` (Debuff; triggers: healed): Half of all healing the bearer receives goes to a random ally of the applier instead.

### `prayer.spore` — Fruiting Psalm
- Prayer · cost Wr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 30 and gain 2 Spores each. Mushrooms that sprout from the user's allies are the user's.
- applies: spores · ops: heal, apply

### `cleave.spore` — Spore Whirl
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to another enemy with Spores (random if several), who gains 1 more.
- applies: spores · ops: damage, forEach, apply

### `shout.spore` — Carrion Bloom
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- The user creates a Mushroom. Then every enemy gains 1 Spore for each Seedling on the user's side, Mushrooms included (up to 2).
- applies: spores · summons: mushroom · ops: summon, set, apply

### `withstand.spore` — Humus Wall
- Withstand · cost W · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield. At the end of each of their later turns, it loses 10 and a random enemy gains 1 Spore, until it's gone.
- applies: humus_wall · ops: apply

### `taunt.spore` — Stinkhorn
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- The user creates a Mushroom. Target enemy is Taunted by it for 2 turns and gains 1 Spore each time they damage it.
- applies: taunt, spores · inline statuses: stinkhorn · summons: mushroom · ops: summon, apply, if
  - inline `stinkhorn` (Debuff; triggers: dealtDamage): Each time the bearer damages a Mushroom, they gain 1 Spore.

### `titan.spore` — Fungal Colossus
- Titan · cost WW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune, a Mushroom sprouts for them at the end of each of their turns, and they have 1 Armor for each Mushroom on their side.
- applies: immune, fungal_colossus · ops: apply

### `sporeling_infecting_lash` — Infecting Lash (minion skill of `sporeling`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains 1 Spore.
- applies: spores · ops: damage, apply

### `bloater_rancid_spit` — Rancid Spit (minion skill of `bloater`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `mushroom` — Mushroom, 15 HP; skills: seedling_channel_earth
- `sporeling` — Sporeling, 40 HP; skills: sporeling_infecting_lash
- `bloater` — Bloater, 20 HP; skills: bloater_rancid_spit

## Named statuses defined here (6) — this group owns their default animations

- `spores` — Spores (Debuff; triggers: effectGained, turnEnd): At the end of its applier's turn, a bearer with 2 or more passes 1 to a random ally. At 3, a Mushroom sprouts from the bearer for the applier, and the bearer loses the 3. _Applied by skills in: spore._
- `mushroom_puff` — Puff (Neutral; triggers: turnEnd): At the end of each of its side's turns, a random enemy gains 1 Spore. _Applied by skills in: none directly._
- `sporeling_feed` — Fed by the Colony (Neutral; triggers: signal): Whenever a Mushroom sprouts for this side, +10 max HP and heals 10. _Applied by skills in: none directly._
- `humus_wall` — Humus Wall (Buff; triggers: turnEnd): A Shield. At the end of each of its applier's later turns, it loses 10 and a random enemy gains 1 Spore. _Applied by skills in: spore._
- `infest` — Infested (Debuff): While the bearer carries Spores, their skills cost 1 more. _Applied by skills in: spore._
- `fungal_colossus` — Fungal Colossus (Buff; triggers: turnEnd): A Mushroom sprouts for the bearer at the end of each of their turns; they have 1 Armor for each Mushroom on their side. _Applied by skills in: spore._

## Macros defined here (1) — this group owns their default animations

- `sprout`: ops summon, signal. _Used by: spore._
