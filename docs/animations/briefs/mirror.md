# Mirror — animation brief

Group id: `mirror`. Element(s): Water + Shadow. Concept file: `docs/animations/concepts/mirror.yaml`.
Skill source: `packages/content/data/fusions/mirror/skills.mirror.yaml`; minions: `packages/content/data/fusions/mirror/minions.mirror.yaml`.

## Skills (32)

### `strike.mirror` — Silvered Blade
- Strike · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they're Blinded, their next Harmful skill is Reflected back at them.
- inline statuses: silvered_blade · ops: damage, if, apply
  - inline `silvered_blade` (Debuff; triggers: skillUsed/reflect): The bearer's next Harmful skill is Reflected back at them.

### `smash.mirror` — Shattered Likeness
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. Then each ally of theirs with more HP than them takes half the difference as damage (max 20).
- ops: damage, forEach, set, if

### `charge.mirror` — Stillwater Step
- Charge · cost S · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 15 damage to target enemy. For 2 turns, Helpful skills the user uses don't break their Stealth. Stealthy.
- inline statuses: stillwater_step · ops: damage, apply
  - inline `stillwater_step` (Buff): The bearer's Helpful skills are Stealthy.

### `riposte.mirror` — Looking Glass
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, every Debuff an enemy gives the user is Reflected onto whoever sent it; the damage still lands. Invisible.
- inline statuses: looking_glass · ops: apply, if, copyEventEffect, eventEffect
  - inline `looking_glass` (Buff, hidden; triggers: effectGained): Debuffs from enemies are Reflected onto whoever sent them.

### `rage.mirror` — Contrary Fury
- Rage · cost SA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might; meanwhile, each Weakness on them counts as 1 Might, and each Vulnerable as 1 Armor.
- applies: might · inline statuses: contrary_fury · ops: apply
  - inline `contrary_fury` (Buff): Each Weakness on the bearer counts as Might, and each Vulnerable as Armor.

### `shot.mirror` — Hairline Crack
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. For 3 turns, the first single hit of 30 or more damage they take is dealt to them a second time.
- inline statuses: hairline_crack · ops: damage, apply, if, removeSelf
  - inline `hairline_crack` (Debuff; triggers: damaged): The first hit of 30 or more lands a second time.

### `snipe.mirror` — Return to Sender
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- On the following turn, the user Mimics the last skill target enemy used, targeting them if it can. Channeled.
- inline statuses: return_to_sender · ops: apply, castSkill
  - inline `return_to_sender` (Neutral): Mimics the target's last skill at them at the end of the following turn.

### `trap.mirror` — False Reflection
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first Helpful skill target enemy uses is countered and used on a random unit on the user's side instead. Invisible.
- inline statuses: false_reflection · ops: apply, castSkill
  - inline `false_reflection` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Helpful skill lands on the applier's side instead.

### `maneuver.mirror` — Through the Glass
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- After 1 turn, if the user's HP is lower than when they used this, it returns to what it was.
- inline statuses: through_the_glass · ops: setCounter, apply, if, heal
  - inline `through_the_glass` (Buff): When this ends, the bearer's HP returns to what it was when it began, if it's lower.

### `companion.mirror` — Doppelganger
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Doppelganger (30 HP) permanently. Mimicry (r): it uses a copy of the last skill its summoner used.
- summons: doppelganger · ops: summon

### `bolt.mirror` — Glintbolt
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, then 15 damage to whoever last damaged the user. If no one has, the target takes it instead.
- ops: damage, if

### `blast.mirror` — Dark Tide
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. The user then Mimics the last skill a random enemy used.
- ops: damage, forEach, castSkill

### `consume.mirror` — Changing Places
- Consume · cost r · cooldown 4 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. Then the user and they trade HP totals, each capped at their own max HP.
- ops: damage, set, if, heal

### `summon.mirror` — Mirror Shade
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Mirror Shade (20 HP) for 3 turns. Glass Shard (nc): 5 damage to target enemy, who gains 1 Confusion. When it's killed, it uses a copy of the skill that killed it on that skill's user.
- summons: mirror_shade · ops: summon

### `channel.mirror` — Hall of Mirrors
- Channel · cost Ir · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies. While it channels, enemy Harmful skills aimed at the user are Reflected. Channeled.
- inline statuses: hall_of_mirrors · ops: apply, damage
  - inline `hall_of_mirrors` (Neutral; triggers: turnEnd, skillTargeted/reflect): Each turn, 10 damage to all enemies; Harmful skills aimed at the bearer are Reflected.

### `stab.mirror` — Glass Shiv
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy if they have less HP than the user. If not, it deals 10, and they gain 1 Confusion.
- applies: confusion · ops: if, damage, apply

### `ravage.mirror` — Foiled Ambush
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, doubled if they're Confused or Blinded.
- ops: damage

### `mislead.mirror` — Mirror Feint
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, the first Harmful skill an enemy aims at the user is countered and used on target enemy instead, even if it's their own. Invisible.
- inline statuses: mirror_feint · ops: apply, castSkill
  - inline `mirror_feint` (Buff, hidden; triggers: skillTargeted/counter): The first Harmful skill an enemy aims at the bearer is countered and used on the enemy targeted by Mirror Feint instead.

### `stun.mirror` — Hypnotic Reflection
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. They're Stunned for 2 turns, or until the user takes damage.
- applies: stun · inline statuses: hypnotic_reflection · ops: damage, apply, removeSelf
  - inline `hypnotic_reflection` (Neutral; triggers: damaged): The enemy Stunned by Hypnotic Reflection stays Stunned until this ends; it ends when the bearer takes damage.

### `dance.mirror` — Dance of Reflections
- Dance · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness at the start of each of their turns. Each time Swiftness stops a Stun, the user Mimics the last skill of the one who tried it.
- applies: swiftness · inline statuses: dance_of_reflections · ops: apply, castSkill
  - inline `dance_of_reflections` (Buff; triggers: turnStart, incomingNegated): Gains 1 Swiftness each turn; each time Swiftness stops a Stun, the bearer Mimics the last skill of the one who tried it.

### `heal.mirror` — Mirrored Mending
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. Within 2 turns, the next Helpful skill an enemy uses lands on that ally instead.
- inline statuses: mirrored_mending · ops: heal, apply, castSkill, removeEffect
  - inline `mirrored_mending` (Debuff, hidden; triggers: skillUsed/counter): The next Helpful skill an enemy uses lands on the applier's ally instead.

### `bless.mirror` — Silvered Veil
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, each enemy who uses a Harmful skill on target ally is Blinded for 2 turns.
- applies: blinded · inline statuses: silvered_veil · ops: apply
  - inline `silvered_veil` (Buff; triggers: skillTargeted): Each enemy who uses a Harmful skill on the bearer is Blinded for 2 turns.

### `curse.mirror` — Maddening Glass
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Blinded for 2 turns and gains 1 Confusion. Each skill they use while Blinded gives them 1 more Confusion.
- applies: blinded, confusion · inline statuses: maddening_glass · ops: apply, if
  - inline `maddening_glass` (Debuff; triggers: skillUsed): Each skill the bearer uses while Blinded gives them 1 Confusion.

### `smite.mirror` — Brand in the Glass
- Smite · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 2 turns, the first time an ally damages them, the user also Mimics the last skill they used.
- inline statuses: brand_in_the_glass · ops: damage, apply, castSkill
  - inline `brand_in_the_glass` (Debuff; triggers: damaged): The first time the applier's side damages the bearer, the applier Mimics their last skill.

### `prayer.mirror` — Reflecting Pool
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. For 2 turns, each ally who takes no damage in a turn gains Stealth at its end.
- applies: stealth · inline statuses: reflecting_pool · ops: heal, apply, setFlag, if
  - inline `reflecting_pool` (Buff; triggers: damaged, turnEnd): If the bearer takes no damage in a turn, they gain Stealth at its end.

### `cleave.mirror` — Rippling Shards
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to a random other enemy. Each ally with Renew gives up 1 stack to add 5 to both hits.
- ops: set, removeStacks, damage

### `shout.mirror` — Inverted Echo
- Shout · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Each enemy's ready skills go on cooldown for 1 turn, and their skills on cooldown become ready.
- applies: intimidated · ops: apply, invertCooldowns

### `withstand.mirror` — Silvered Guard
- Withstand · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 2 turns. Each enemy who damages it takes as much damage as it absorbed.
- inline statuses: silvered_guard · ops: apply, if, damage
  - inline `silvered_guard` (Buff; triggers: shieldDamaged): A Shield; each enemy who damages it takes as much damage as it absorbed.

### `taunt.mirror` — Face in the Glass
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 2 turns, target enemy and the user are each Taunted by the other, and each hit the enemy lands on the user also deals them half as much damage.
- applies: taunt · inline statuses: face_in_the_glass · ops: apply, if, damage
  - inline `face_in_the_glass` (Debuff; triggers: dealtDamage): Each hit the bearer lands on the applier deals the bearer half as much.

### `titan.mirror` — Mirror of the Faceless
- Titan · cost IW · cooldown 4 · target **enemy** · tags Harmful, Strategic
- For 3 turns, the user gains 2 Armor and copies of target enemy's Buffs. Then the user Mimics that enemy's last skill.
- applies: armor · ops: apply, copyEffects, castSkill

### `doppelganger_mimicry` — Mimicry (minion skill of `doppelganger`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- Uses a copy of the last skill its summoner used.
- ops: castSkill

### `mirror_shade_glass_shard` — Glass Shard (minion skill of `mirror_shade`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, who gains 1 Confusion.
- applies: confusion · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `doppelganger` — Doppelganger, 30 HP; skills: doppelganger_mimicry
- `mirror_shade` — Mirror Shade, 20 HP; skills: mirror_shade_glass_shard
