# Fire — animation brief

Group id: `fire`. Element(s): Fire. Concept file: `docs/animations/concepts/fire.yaml`.
Skill source: `packages/content/data/fire/skills.fire.yaml`; minions: `packages/content/data/fire/minions.fire.yaml`; statuses: `packages/content/data/fire/statuses.fire.yaml`; macros: `packages/content/data/fire/macros.fire.yaml`.

## Skills (30)

### `strike.fire` — Torch Strike
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and Ignites them.
- applies: ignite · ops: damage, apply

### `smash.fire` — Chain Detonation
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, then every Ignited enemy Explodes.
- macros: explode · ops: damage, forEach, if, macro

### `charge.fire` — Hot Foot
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If they are Ignited, the user gains 2 Might until they use a new damaging skill; otherwise, they are Ignited.
- applies: might, ignite · ops: set, damage, if, apply

### `riposte.fire` — Blisterblade
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user will counter any Harmful skill used on them, Igniting the triggering enemy. If they are already Ignited, they are Scorched instead. Invisible.
- applies: scorched, ignite · inline statuses: blisterblade · ops: apply, if
  - inline `blisterblade` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer, Igniting the attacker (or Scorching them if already Ignited).

### `rage.fire` — Blazing Fury
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Flameborn.
- applies: might, flameborn · ops: apply

### `shot.fire` — Flickerflare
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Ignites them. If the enemy is already Ignited, an additional random enemy is Ignited.
- applies: ignite · ops: set, damage, apply, if

### `snipe.fire` — Heat Seeker
- Snipe · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user deals 40 damage to target enemy on the following turn and permanently Scorches them. The target of this skill is invisible. Channeled.
- applies: scorched · inline statuses: heat_seeker · ops: apply, damage
  - inline `heat_seeker` (Neutral): Fires at the end of the following turn unless the user is stunned, dies or uses another skill.

### `trap.fire` — Hidden Explosives
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, an Explosion is triggered. Invisible.
- inline statuses: hidden_explosives · macros: explode · ops: apply, macro
  - inline `hidden_explosives` (Debuff, hidden; triggers: skillUsed): When the bearer uses a Harmful skill, an Explosion is triggered.

### `maneuver.fire` — Flame Dash
- Maneuver · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains Flameborn and becomes Invulnerable for 1 turn.
- applies: flameborn, invulnerable · ops: apply

### `companion.fire` — Dragon Hatchling
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Dragon Hatchling minion. The minion gives its owner Flameborn and deals 10 Affliction damage to a random enemy each turn, Igniting them.
- summons: dragon_hatchling · ops: summon

### `bolt.fire` — Fireball
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the target is Ignited, they Explode.
- macros: explode · ops: damage, if, macro

### `blast.fire` — Inferno
- Blast · cost S · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- Ignites all enemies.
- applies: ignite · ops: apply

### `consume.fire` — Feed the Fire
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If they are Ignited, the Ignite is consumed and the user heals 20; otherwise, they are Ignited.
- applies: ignite · ops: set, damage, if, removeEffect, heal, apply

### `summon.fire` — Cinderlings
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons two Cinderlings for 2 turns; each deals 5 Affliction damage to the enemy team each turn.
- summons: cinderling · ops: summon

### `channel.fire` — Flamethrower
- Channel · cost SI · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Deals 10 damage to all enemies for 3 turns. Each Ignited enemy damaged by this skill causes an Explosion. Channeled.
- inline statuses: flamethrower · macros: explode · ops: apply, damage, forEach, if, macro
  - inline `flamethrower` (Neutral; triggers: turnEnd): Deals 10 damage to all enemies at the end of each of the user's turns; Ignited targets Explode.

### `stab.fire` — Searing Needle
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If they are Ignited or Scorched, they also take 10 Affliction damage; otherwise, they are Ignited.
- applies: ignite · ops: set, damage, if, signal, apply

### `ravage.fire` — Pyrokinesis
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Affliction damage to target enemy. If the target is Ignited or Scorched, this skill deals double damage.
- ops: damage

### `mislead.fire` — Heat Haze
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a skill, they will be Ignited and Scorched. Invisible.
- applies: ignite, scorched · inline statuses: heat_haze · ops: apply
  - inline `heat_haze` (Debuff, hidden; triggers: skillUsed): When the bearer uses a skill, they are Ignited and Scorched.

### `stun.fire` — Flashbang
- Stun · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and stuns their non-Strategic skills for 1 turn.
- applies: stun_ns · ops: damage, apply

### `dance.fire` — Ivory Step
- Dance · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- The user gains Immune for 1 turn and Explodes.
- applies: immune · macros: explode · ops: apply, macro

### `heal.fire` — Flamethirst
- Heal · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Flameborn for 2 turns, and their next Harmful skill Ignites its targets.
- applies: flameborn, ignite · inline statuses: flamethirst · ops: apply
  - inline `flamethirst` (Buff; triggers: skillResolved): The bearer's next Harmful skill Ignites its targets (as the bearer's own Ignites).

### `bless.fire` — Burning Blood
- Bless · cost S · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally gains 2 Might until the end of the turn.
- applies: might · ops: apply

### `curse.fire` — Overheat Metal
- Curse · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Weakness and 1 Vulnerable for 2 turns.
- applies: weakness, vulnerable · ops: apply

### `smite.fire` — Searing Brand
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the target was Ignited, they gain 2 Weakness for 1 turn.
- applies: weakness · ops: damage, if, apply

### `prayer.fire` — Searing Aegis
- Prayer · cost SW · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- Grants 10 Shield and Flameborn to all allies for 3 turns.
- applies: shield, flameborn · ops: apply

### `cleave.fire` — Blastwave
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and an additional random enemy. If either target is Ignited, they Explode.
- macros: explode · ops: damage, if, macro

### `shout.fire` — Blistering Cry
- Shout · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Applies Ignite to target enemy. If the enemy is already Ignited, the user gains Flameborn for 1 turn.
- applies: ignite, flameborn · ops: set, apply, if

### `withstand.fire` — Ashen Barrier
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield. Each enemy that damages this Shield is Ignited.
- applies: ignite · inline statuses: ashen_barrier · ops: apply
  - inline `ashen_barrier` (Buff; triggers: shieldDamaged): Absorbs damage; each enemy that damages it is Ignited.

### `taunt.fire` — Ring of Fire
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 1 turn. If they use a Harmful skill during this time, they are Ignited. If they do not, they are Scorched for 2 turns.
- applies: taunt, ignite, scorched · inline statuses: ring_of_fire · ops: apply, setFlag, if
  - inline `ring_of_fire` (Debuff; triggers: skillUsed): Using a Harmful skill Ignites the bearer; using none Scorches them for 2 turns when this ends.

### `titan.fire` — Wraith in White
- Titan · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- The user Ignites all enemies, then gains Immune and Flameborn for 3 turns.
- applies: ignite, immune, flameborn · ops: apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `dragon_hatchling` — Dragon Hatchling, 30 HP; skills: none
  - passive `dragon_breath` (triggers: turnEnd): At the end of its owner's turn, deals 10 Affliction damage to a random enemy and Ignites them.
- `cinderling` — Cinderling, 10 HP; skills: none
  - passive `cinder_burst` (triggers: turnEnd): At the end of its owner's turn, deals 5 Affliction damage to each enemy.

## Named statuses defined here (3) — this group owns their default animations

- `ignite` — Ignite (Debuff; triggers: turnEnd, turnStart): Takes 5 Affliction damage at the end of the applier's turn. Does not stack. If the applier is Flameborn, they heal for the damage dealt. _Applied by skills in: fire, alchemy, apocalypse, brimstone, dragon, mechanic, phoenix, plasma, ritual, sun._
- `scorched` — Scorched (Debuff): Healing received is halved (rounded up to the nearest 5). _Applied by skills in: fire, apocalypse, dragon, plasma, sun._
- `flameborn` — Flameborn (Buff; triggers: signal): Heals for the damage dealt by the bearer's Ignites, and heals 10 whenever the bearer's side causes an Explosion. _Applied by skills in: fire, brimstone, devil._

## Macros defined here (2) — this group owns their default animations

- `burn_aftermath`: ops if, heal, apply, forEach, macro; applies hoard. _Used by: brimstone, dragon._
- `explode`: ops damage, signal, forEach, macro. _Used by: fire, alchemy, apocalypse, brimstone, dragon, mechanic, plasma, ritual._
