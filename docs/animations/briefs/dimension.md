# Dimension — animation brief

Group id: `dimension`. Element(s): Shadow + Shadow. Concept file: `docs/animations/concepts/dimension.yaml`.
Skill source: `packages/content/data/fusions/dimension/skills.dimension.yaml`; minions: `packages/content/data/fusions/dimension/minions.dimension.yaml`; statuses: `packages/content/data/fusions/dimension/statuses.dimension.yaml`.

## Skills (33)

### `strike.dimension` — Folded Moment
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, FreeAction
- Deals 10 damage to target enemy. This doesn't use up the user's turn, so they can use another skill this turn.
- ops: damage

### `smash.dimension` — Implosion
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy and 20 to their allies; then the user is Banished.
- applies: banished_ally · ops: damage, interrupt, apply

### `charge.dimension` — Phase Lunge
- Charge · cost S · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Bypass
- Deals 15 damage to target enemy, Bypassing. The user gains Stealth at the start of their next turn unless an enemy targets them first.
- inline statuses: phase_lunge · macros: gain_stealth · ops: damage, apply, removeSelf, forEach, macro
  - inline `phase_lunge` (Buff; triggers: skillTargeted): Gains Stealth at the start of the bearer's next turn unless an enemy targets them first.

### `riposte.dimension` — Pocket Dimension
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, and its user is Banished. Invisible.
- applies: banished · inline statuses: pocket_dimension · ops: apply, interrupt
  - inline `pocket_dimension` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer and Banishes its user.

### `rage.dimension` — Void Walker
- Rage · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic, Stealthy
- For 3 turns, the user gains 1 Might and Immune. Each time a skill of theirs ends their Stealth, its targets are Blinded for 1 turn. Stealthy.
- applies: might, immune, blinded · inline statuses: void_walker · ops: apply, if
  - inline `void_walker` (Buff; triggers: skillUsed): A skill that ends the bearer's Stealth Blinds its targets for 1 turn.

### `shot.dimension` — Echo Shard
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy. If they're Entangled, their partners take it too; if not, they're Entangled with a random ally for 2 turns.
- ops: if, damage, entangle

### `snipe.dimension` — Through the Rift
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget, Stealthy
- On the following turn, deals 40 damage to target enemy. Channeling and landing it don't end the user's Stealth. The target of this skill is invisible. Channeled, Stealthy.
- inline statuses: through_the_rift · ops: apply, damage
  - inline `through_the_rift` (Neutral): Strikes its target at the end of the following turn unless interrupted.

### `trap.dimension` — Event Horizon
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time target enemy uses a Helpful skill, its target is Banished instead of helped. Invisible.
- applies: banished · inline statuses: event_horizon · ops: apply, interrupt
  - inline `event_horizon` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Helpful skill is countered, and its target is Banished.

### `maneuver.dimension` — Step Between
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user is Banished, and so is the last enemy who damaged them.
- applies: banished, banished_ally · ops: interrupt, apply

### `companion.dimension` — Void Stalker
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Void Stalker (30 HP) permanently. Tether (r): target enemy and a random ally of theirs are Entangled for 2 turns. Rend (r): 10 Piercing damage, and Entangled partners take it too.
- summons: void_stalker · ops: summon

### `bolt.dimension` — Dark Matter
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy, and the user is Blinded for 1 turn.
- applies: blinded · ops: damage, apply

### `blast.dimension` — Singularity
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies; then the one with the most HP is Banished.
- applies: banished · ops: damage, interrupt, apply

### `consume.dimension` — Sever
- Consume · cost r · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to all enemies, and a random one of them who isn't Blinded is Blinded for 1 turn.
- applies: blinded · ops: damage, apply

### `summon.dimension` — Rift
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Rift (20 HP) for 3 turns. Shunt (I): target enemy is Isolated for 1 turn, or Banished if they already were.
- summons: rift · ops: summon

### `channel.dimension` — Crossfold
- Channel · cost Ar · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies, and a random ally's Debuff trades places with a random enemy's Buff. Channeled.
- inline statuses: crossfold · ops: apply, damage, stealRandom
  - inline `crossfold` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies, and a Debuff and a Buff trade sides.

### `stab.dimension` — Unwatched Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains Open Cut until the end of the user's next turn. If the user uses this skill on a different enemy meanwhile, the enemy with Open Cut takes 10 damage too.
- inline statuses: open_cut · ops: damage, removeEffect, apply
  - inline `open_cut` (Debuff): If the applier uses Unwatched Knife on a different enemy, the bearer takes 10 damage.

### `ravage.dimension` — Rend Space
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy; any Blind or Isolation on them lasts 2 turns longer.
- ops: damage, extendEffects

### `mislead.dimension` — Crossed Doors
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and they're Entangled with a random ally for 2 turns; then they're Isolated for 1 turn, so both are. Invisible.
- applies: isolated · inline statuses: crossed_doors · ops: apply, entangle
  - inline `crossed_doors` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Harmful skill is countered; they're Entangled with an ally and Isolated.

### `stun.dimension` — Phase Lock
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Banished. When they return, they're Blinded for 1 turn.
- applies: banished, blinded · inline statuses: phase_lock · ops: interrupt, apply
  - inline `phase_lock` (Debuff): When the bearer returns from being Banished, they're Blinded for 1 turn.

### `dance.dimension` — Unfold
- Dance · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user is Banished. When they return, they gain Stealth, and Ghosted and 1 Focus for 2 turns.
- applies: banished_ally, ghosted, focus · inline statuses: unfold · macros: gain_stealth · ops: interrupt, apply, forEach, macro
  - inline `unfold` (Buff): When the bearer returns, they gain Stealth, Ghosted and 1 Focus.

### `heal.dimension` — Safe Harbor
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally is Banished. When they return, they heal 30 and lose their Debuffs.
- applies: banished_ally · inline statuses: safe_harbor · ops: interrupt, apply, heal, removeKind
  - inline `safe_harbor` (Buff): When the bearer returns, they heal 30 and lose their Debuffs.

### `bless.dimension` — Out of Phase
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 2 Might for 2 turns, but they're Isolated for as long.
- applies: might, isolated · ops: apply

### `curse.dimension` — Tangled Fates
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy and a random ally of theirs are Entangled for 3 turns. Each time either uses a skill, the other gains 1 Confusion, so both do.
- applies: confusion · inline statuses: tangled_fates · ops: entangle, apply
  - inline `tangled_fates` (Debuff; triggers: skillUsed): Each skill the bearer uses gives them (and their Entangled partner) 1 Confusion.

### `smite.dimension` — Void Brand
- Smite · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. For 2 turns, the user's side can target them even if they're Stealthed, Untargetable or Invulnerable.
- inline statuses: void_brand · ops: damage, apply
  - inline `void_brand` (Debuff): Every enemy of the bearer can target them past Stealth, Untargetable and Invulnerable.

### `prayer.dimension` — Lifeline Weave
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and are Entangled together for 2 turns, but only Buffs pass through this link.
- ops: heal, entangle

### `cleave.dimension` — Shear
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. The first of their allies to use a skill before the user's next turn takes 15 damage.
- inline statuses: shear · ops: damage, apply, removeEffect, removeSelf
  - inline `shear` (Debuff; triggers: skillUsed): The first enemy with Shear to use a skill takes 15 damage; then it ends on all of them.

### `shout.dimension` — Dislocation
- Shout · cost Ar · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Entangled together for 2 turns, then Blinded for 1 turn.
- applies: blinded · ops: entangle, apply

### `withstand.dimension` — Pocket Ward
- Withstand · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. Whenever it absorbs damage, the ally with the least HP gains that much Shield for 1 turn.
- applies: shield · inline statuses: pocket_ward · ops: apply
  - inline `pocket_ward` (Buff; triggers: shieldDamaged): What this Shield absorbs becomes Shield on the ally with the least HP.

### `taunt.dimension` — Pocket Arena
- Taunt · cost r · cooldown 4 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 1 turn, and every other unit on both sides, minions included, is Banished.
- applies: taunt, banished, banished_ally · ops: apply, interrupt

### `titan.dimension` — Faceless Void
- Titan · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Entangled with the ally with the least HP, then gains 2 Armor and Immune, so that ally does too.
- applies: armor, immune · ops: entangle, apply

### `void_stalker_tether` — Tether (minion skill of `void_stalker`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy and a random ally of theirs are Entangled for 2 turns.
- ops: entangle

### `void_stalker_rend` — Rend (minion skill of `void_stalker`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy, and their Entangled partners take it too.
- ops: damage

### `rift_shunt` — Shunt (minion skill of `rift`)
- Minion · cost I · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Isolated for 1 turn, or Banished if they already were.
- applies: banished, isolated · ops: if, interrupt, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `void_stalker` — Void Stalker, 30 HP; skills: void_stalker_tether, void_stalker_rend
- `rift` — Rift, 20 HP; skills: rift_shunt

## Named statuses defined here (4) — this group owns their default animations

- `banished` — Banished (Debuff): Out of the fight: can't act or be targeted by anyone, takes no damage, and their effects neither tick nor expire. _Applied by skills in: dimension._
- `banished_ally` — Banished (Buff): Out of the fight: can't act or be targeted by anyone, takes no damage, and their effects neither tick nor expire. _Applied by skills in: dimension._
- `entangled` — Entangled (Neutral): Linked to other units on the same side; any effect applied to one is applied to the others too. _Applied by skills in: none directly._
- `entangled_buffs` — Entangled (Buffs) (Neutral): Linked to other allies; any Buff applied to one is applied to the others too. _Applied by skills in: none directly._
