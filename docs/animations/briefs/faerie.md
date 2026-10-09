# Faerie — animation brief

Group id: `faerie`. Element(s): Wind + Poison. Concept file: `docs/animations/concepts/faerie.yaml`.
Skill source: `packages/content/data/fusions/faerie/skills.faerie.yaml`; minions: `packages/content/data/fusions/faerie/minions.faerie.yaml`; statuses: `packages/content/data/fusions/faerie/statuses.faerie.yaml`.

## Skills (32)

### `strike.faerie` — Thorned Kiss
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Charmed for their next skill (within 1 turn). The user gains 1 Toxin.
- applies: charmed, toxin · ops: damage, apply

### `smash.faerie` — Fairy Ring
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to their allies. Each one hit who has a mobility buff loses them all and is Charmed for 1 turn.
- applies: charmed · ops: damage, forEach, removeEffect, apply

### `charge.faerie` — Thistledown Hop
- Charge · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, then the user Leaps.
- inline statuses: thistledown_hop · macros: leap · ops: damage, apply, forEach, macro
  - inline `thistledown_hop` (Buff): The user Leaps once this skill has resolved.

### `riposte.faerie` — Prank
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the first Harmful skill used on the user is countered: a random ally of its user takes 15 damage instead, and its user is Charmed for 1 turn. Invisible.
- applies: charmed · inline statuses: prank · ops: apply, damage
  - inline `prank` (Buff, hidden; triggers: skillTargeted/counter): The first Harmful skill used on the bearer is countered: a random ally of its user takes 15 damage instead, and its user is Charmed for 1 turn.

### `rage.faerie` — Wild Hunt
- Rage · cost W · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, once per turn, when the user deals direct damage to an enemy, a random other enemy takes 10 damage and gains 1 Toxin.
- applies: toxin · inline statuses: wild_hunt · ops: apply, if, setCounter, forEach, damage
  - inline `wild_hunt` (Buff; triggers: dealtDamage): Once per turn, when the bearer deals direct damage to an enemy, a random other enemy takes 10 damage and gains 1 Toxin.

### `shot.faerie` — Pixie Dust
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains 1 Confusion. If they already had Confusion, they're Charmed for 1 turn instead.
- applies: charmed, confusion · ops: damage, if, apply

### `snipe.faerie` — Elfshot
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget, Uncounterable
- On the following turn, deals 30 Affliction damage to target enemy; if any other enemy has more Toxin than them by then, a random one of those takes it instead. The target of this skill is invisible. Channeled, Uncounterable.
- inline statuses: elfshot · ops: apply, if, damage
  - inline `elfshot` (Neutral): At the end of the following turn, deals 30 Affliction damage to its target, or to a random enemy with more Toxin than them instead.

### `trap.faerie` — Toadstool Circle
- Trap · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, whenever target enemy uses a Helpful skill, they gain 1 Toxin and are Charmed for 1 turn. Invisible.
- applies: toxin, charmed · inline statuses: toadstool_circle · ops: apply
  - inline `toadstool_circle` (Debuff, hidden; triggers: skillUsed): Each Helpful skill the bearer uses gives them 1 Toxin and Charms them for 1 turn.

### `maneuver.faerie` — Petal Step
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user Leaps; their Leap's bonus damage is 5 per Toxin on the target it hits instead of 5.
- inline statuses: petal_step · macros: leap · ops: forEach, macro, apply
  - inline `petal_step` (Buff): The Leap's bonus is 5 per Toxin on the target instead of 5.

### `companion.faerie` — Pixie
- Companion · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Pixie (25 HP) permanently; it's Untargetable while any enemy is Charmed. Befuddle (A): target enemy is Charmed for 1 turn, or 2 if they're Prey.
- summons: pixie · ops: summon

### `bolt.faerie` — Wisp Bolt
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, each skill they use deals them 10 Affliction damage.
- inline statuses: wisp_bolt · ops: damage, apply
  - inline `wisp_bolt` (Debuff; triggers: skillUsed): Each skill the bearer uses deals them 10 Affliction damage.

### `blast.faerie` — Dust Storm
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies; each is Charmed for their next skill (within 2 turns).
- applies: charmed · ops: damage, apply

### `consume.faerie` — Changeling's Bargain
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. Then one of the user's Debuffs moves to them, and one of their Buffs moves to the user.
- ops: damage, heal, stealRandom

### `summon.faerie` — Sprite Swarm
- Summon · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons 2 Sprites (10 HP) for 3 turns; an enemy who damages a Sprite is Charmed for 1 turn. Pinch (nc): 5 Piercing damage.
- summons: sprite · ops: summon

### `channel.faerie` — Midsummer Revel
- Channel · cost II · cooldown 3 · target **allEnemies** · tags Harmful, Strategic, Channeled
- For 3 turns, at the end of each of the user's turns, a random enemy is Charmed for 1 turn, and every Charmed enemy takes 10 Affliction damage. Channeled.
- applies: charmed · inline statuses: midsummer_revel · ops: apply, damage
  - inline `midsummer_revel` (Neutral; triggers: turnEnd): Each turn, a random enemy is Charmed, and every Charmed enemy takes 10 Affliction.

### `stab.faerie` — Nettle Prick
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Target enemy takes 5 Piercing damage and gains 1 Toxin, and until the user's next turn their Toxin also ticks at the start of their own turn.
- applies: toxin · inline statuses: nettle_prick · ops: damage, apply
  - inline `nettle_prick` (Debuff; triggers: turnStart): The bearer's Toxin also ticks at the start of their turn.

### `ravage.faerie` — Wasp Dive
- Ravage · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- The user spends all their Swiftness, then deals 25 Piercing damage to target enemy, +10 per stack spent.
- ops: set, removeEffect, damage

### `mislead.faerie` — Fae Wager
- Mislead · cost A · cooldown 1 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and the user gains 1 Swiftness and 1 Focus. If they don't, the user is Charmed for 1 turn. Invisible.
- applies: swiftness, focus, charmed · inline statuses: fae_wager · ops: apply
  - inline `fae_wager` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and the applier gains 1 Swiftness and 1 Focus. If the bearer uses none, the applier is Charmed for 1 turn when this ends.

### `stun.faerie` — Enchanted Slumber
- Stun · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy falls Asleep for 3 turns. Damage doesn't wake them; instead, each hit they take cuts 1 turn from the Sleep.
- inline statuses: enchanted_slumber · ops: apply, extendSelf
  - inline `enchanted_slumber` (Debuff; triggers: damaged): Asleep; each hit cuts 1 turn from it instead of waking them.

### `dance.faerie` — Fey Reel
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might, 2 Swiftness and 1 Focus, and is Charmed.
- applies: might, swiftness, focus, charmed · ops: apply

### `heal.faerie` — Fairy Tonic
- Heal · cost A · cooldown 1 · target **any** · tags Radiant, Strategic
- Target unit heals 20. An ally also loses all Toxin; an enemy is Charmed for 1 turn.
- applies: charmed · ops: heal, if, apply, removeEffect

### `bless.faerie` — Fairy Wings
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, each Stun that would land on target ally Charms them for 1 turn instead.
- applies: charmed · inline statuses: fairy_wings · ops: apply, addStacksSelf
  - inline `fairy_wings` (Buff; triggers: incomingNegated): Each Stun that would land on the bearer Charms them for 1 turn instead.

### `curse.faerie` — Enthrall
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Charmed for 2 turns. Each ally of theirs they damage while Charmed is Charmed for 1 turn too.
- applies: charmed · inline statuses: enthrall · ops: apply, if
  - inline `enthrall` (Debuff; triggers: dealtDamage): Each ally of the bearer they damage while Charmed is Charmed too.

### `smite.faerie` — Fey Mark
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each ally of theirs who uses a Helpful skill on them is Charmed for 1 turn.
- applies: charmed · inline statuses: fey_mark · ops: damage, apply, if
  - inline `fey_mark` (Debuff; triggers: skillTargeted): Each ally of the bearer who uses a Helpful skill on them is Charmed for 1 turn.

### `prayer.faerie` — Fairy Song
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and lose their Toxin; each stack removed goes to a random enemy.
- applies: toxin · ops: heal, set, removeEffect, repeat, apply

### `cleave.faerie` — Glamoured Feint
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Target enemy is Charmed for their next skill (within 1 turn), and each other enemy takes 20 damage. If there's no other enemy, target enemy takes the 20 damage instead.
- applies: charmed · ops: apply, if, damage

### `shout.faerie` — Fae Laughter
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For 2 turns, at the end of each of the user's turns, each enemy whose ally used a skill since the user's last turn gains 1 Confusion.
- applies: confusion · inline statuses: fae_laughter, fae_giggles · ops: apply, if, removeEffect
  - inline `fae_laughter` (Debuff; triggers: skillUsed, turnEnd): Each skill the bearer uses makes their allies Giggling; Giggling enemies gain 1 Confusion at the end of the applier's turn.
  - inline `fae_giggles` (Neutral): Gains 1 Confusion at the end of the applier's turn.

### `withstand.faerie` — Gossamer Veil
- Withstand · cost W · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn. Each enemy who hits it is Charmed for 1 turn.
- applies: charmed · inline statuses: gossamer_veil · ops: apply, if
  - inline `gossamer_veil` (Buff; triggers: shieldDamaged): A Shield; each enemy who hits it is Charmed for 1 turn.

### `taunt.faerie` — Fickle Heart
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by a random ally of theirs for 1 turn, or 2 if they're Prey, so that ally is all they can target.
- applies: taunt · ops: apply

### `titan.faerie` — Faerie Queen
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune. A Sprite (10 HP) is summoned for her now and at the start of each of her turns, for 2 turns each, and she takes 5 less damage for each allied Sprite.
- applies: immune · inline statuses: faerie_queen · summons: sprite · ops: apply, summon
  - inline `faerie_queen` (Buff; triggers: turnStart): A Sprite is summoned for the bearer at the start of each of her turns; she takes 5 less damage per allied Sprite.

### `pixie_befuddle` — Befuddle (minion skill of `pixie`)
- Minion · cost A · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Charmed for 1 turn, or 2 if they're Prey.
- applies: charmed · ops: apply

### `sprite_pinch` — Pinch (minion skill of `sprite`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `pixie` — Pixie, 25 HP; skills: pixie_befuddle
  - passive `pixie_hide`: Untargetable by enemies while any enemy is Charmed.
- `sprite` — Sprite, 10 HP; skills: sprite_pinch
  - passive `sprite_mischief` (triggers: damaged): An enemy who damages it is Charmed for 1 turn.

## Named statuses defined here (1) — this group owns their default animations

- `charmed` — Charmed (Debuff): The bearer's single-target skills pick their target at random from every other unit in the battle, friend or foe. _Applied by skills in: faerie._
