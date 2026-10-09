# Vigilante — animation brief

Group id: `vigilante`. Element(s): Holy + Shadow. Concept file: `docs/animations/concepts/vigilante.yaml`.
Skill source: `packages/content/data/fusions/vigilante/skills.vigilante.yaml`; minions: `packages/content/data/fusions/vigilante/minions.vigilante.yaml`; statuses: `packages/content/data/fusions/vigilante/statuses.vigilante.yaml`.

## Skills (33)

### `strike.vigilante` — Street Justice
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they were the last enemy to damage the user, they're Exposed for 1 turn first, so this deals 10 more.
- applies: exposed · ops: if, apply, damage

### `smash.vigilante` — Round Up the Gang
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy, and 25 to each other enemy carrying a Buff.
- ops: damage

### `charge.vigilante` — Pursuit
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the user is Stealthed, the target is Exposed for 2 turns first, so this deals 10 more; if not, the user gains Stealth.
- applies: exposed, stealth · ops: if, apply, damage

### `riposte.vigilante` — Caught Red-Handed
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the first Harmful skill an enemy uses on any of the user's allies, the user excluded, is countered, and its user is Exposed for 2 turns. Invisible.
- applies: exposed · inline statuses: caught_red_handed · ops: apply, removeEffect
  - inline `caught_red_handed` (Buff, hidden; triggers: skillTargeted/counter): The first Harmful skill an enemy uses on the bearer (or on another ally the same watcher covers) is countered, and its user is Exposed for 2 turns.

### `rage.vigilante` — The Hunt Begins
- Rage · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, each enemy they damage is Exposed for 2 turns, and they deal 5 more to Exposed enemies.
- applies: might, exposed · inline statuses: the_hunt_begins · ops: apply
  - inline `the_hunt_begins` (Buff; triggers: dealtDamage): The bearer deals 5 more to Exposed enemies, and each enemy they damage is Exposed for 2 turns.

### `shot.vigilante` — Searchlight
- Shot · cost r · cooldown 0 · target **self** · tags Harmful, NonStrategic
- Deals 10 damage to a random enemy, Stealthed ones included. If they had Stealth, they're Exposed for 2 turns.
- applies: exposed · ops: forEach, set, if, apply, damage

### `snipe.vigilante` — From the Rooftops
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy; if they gained Stealth or used an Invisible skill meanwhile, 20 more and Exposed for 2 turns. The target of this skill is invisible. Channeled.
- applies: exposed · inline statuses: rooftop_watch, from_the_rooftops · ops: apply, addStacksSelf, if, forEach, damage
  - inline `rooftop_watch` (Neutral, hidden; triggers: effectGained, skillUsed): Tracks whether the bearer gains Stealth or uses an Invisible skill.
  - inline `from_the_rooftops` (Neutral): When this runs out, its target takes 40 damage, or 60 and is Exposed for 2 turns if they gained Stealth or used an Invisible skill meanwhile.

### `trap.vigilante` — Sting Operation
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, if target enemy uses a Stealthy or Invisible skill, it's countered and they're Exposed for 2 turns. Invisible.
- applies: exposed · inline statuses: sting_operation · ops: apply
  - inline `sting_operation` (Debuff, hidden; triggers: skillUsed/counter, skillUsed/counter): The bearer's next Stealthy or Invisible skill is countered and Exposes them.

### `maneuver.vigilante` — Safe Passage
- Maneuver · cost r · cooldown 4 · target **ally** · tags Helpful, Strategic
- The user and target ally become Invulnerable for 1 turn. The user can't use Harmful skills on their next turn.
- applies: invulnerable · inline statuses: safe_passage · ops: apply
  - inline `safe_passage` (Debuff): Can't use Harmful skills.

### `companion.vigilante` — Bloodhound
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Bloodhound (30 HP) permanently. Run Down (r): 10 Piercing damage. Scent (r): target enemy is Exposed for as long as the Bloodhound lives, until it uses Scent again.
- summons: bloodhound · ops: summon

### `bolt.vigilante` — Cover Fire
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. The user's other ally with the least HP gains Stealth if they haven't acted yet this turn.
- applies: stealth · ops: damage, if, apply

### `blast.vigilante` — Floodlight
- Blast · cost Irr · cooldown 2 · target **self** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies, Stealthed ones included. Those with Stealth or Invulnerable are Exposed for 2 turns first, and take 10 more.
- applies: exposed · ops: forEach, if, apply, damage

### `consume.vigilante` — Shakedown
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and takes a random Buff of theirs for the user. If they have none, the user heals 15 instead.
- ops: damage, if, stealRandom, heal

### `summon.vigilante` — Informant
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Informant (15 HP) for 3 turns. Whoever damages it is Exposed for 2 turns. Tip Off (r): the user's next skill is Stealthy.
- summons: informant · ops: summon

### `channel.vigilante` — Night Patrol
- Channel · cost A · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, every enemy who used a Harmful skill since takes 10 damage and is Exposed for 1 turn. Channeled.
- applies: patrol_watch, exposed · inline statuses: night_patrol · ops: apply, forEach, damage
  - inline `night_patrol` (Neutral; triggers: turnEnd): Each turn, every enemy who used a Harmful skill since takes 10 damage and is Exposed.

### `stab.vigilante` — Quiet Verdict
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic, Invisible
- At the end of the user's next turn, target enemy takes 10 damage, or 25 if they're at or below 60 HP by then. Invisible.
- inline statuses: quiet_verdict · ops: apply, damage
  - inline `quiet_verdict` (Debuff, hidden): At the end of the applier's next turn, the bearer takes 10 damage, or 25 at or below 60 HP.

### `ravage.vigilante` — Take Down
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. If they're Exposed, it ends, and they're Stunned for 1 turn.
- applies: stun · ops: damage, if, removeEffect, apply

### `mislead.vigilante` — Setup
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they're Condemned; for 2 turns, any ally of theirs who gives them a Buff is Exposed for 2 turns. Invisible.
- applies: condemned, setup_watch · inline statuses: setup · ops: apply
  - inline `setup` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they're Condemned; for 2 turns, any ally of theirs who gives them a Buff is Exposed for 2 turns.

### `stun.vigilante` — Chokehold
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who falls Asleep for 1 turn. An Exposed target is Stunned for 2 turns instead.
- applies: stun, sleep · ops: damage, if, apply

### `dance.vigilante` — Mask On
- Dance · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- The user gains Stealth and 1 Swiftness. While they stay Stealthed, their skills deal 10 more to Exposed enemies.
- applies: stealth, swiftness · inline statuses: mask_on · ops: apply, if, damage
  - inline `mask_on` (Buff; triggers: dealtDamage): While Stealthed, the bearer's hits on Exposed enemies deal 10 more.

### `heal.vigilante` — Witness Statement
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- The last enemy to damage target ally takes 10 damage, and the ally heals 10 plus the damage dealt. If no enemy has damaged them, they heal 15 instead.
- ops: if, damage, heal

### `bless.vigilante` — Watcher in the Dark
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic, Invisible
- For 3 turns, the first time target ally takes damage, they gain 25 Shield and 2 Might for 2 turns. Invisible.
- applies: shield, might · inline statuses: watcher_in_the_dark · ops: apply
  - inline `watcher_in_the_dark` (Buff, hidden; triggers: damaged): The first time the bearer takes damage, they gain 25 Shield and 2 Might for 2 turns.

### `curse.vigilante` — Most Wanted
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Exposed for 3 turns. The first ally of the user to damage them gains Stealth.
- applies: exposed, stealth · inline statuses: most_wanted · ops: apply
  - inline `most_wanted` (Debuff; triggers: damaged): The first of the applier's side to hit the bearer gains Stealth.

### `smite.vigilante` — Full Sentence
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 2 turns, after each Harmful skill they use, each of its targets heals 10.
- inline statuses: full_sentence · ops: damage, apply, heal
  - inline `full_sentence` (Debuff; triggers: skillResolved): After each Harmful skill the bearer uses, each of its targets heals 10.

### `prayer.vigilante` — Dawn Vigil
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield. Each Anointed ally spends their Anointed to remove all their Debuffs.
- applies: shield · ops: heal, apply, forEach, removeEffect, removeKind

### `cleave.vigilante` — Sweep the Streets
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to each other Exposed enemy. If no other enemy is Exposed, a random other enemy takes the 15 instead and is Exposed for 1 turn.
- applies: exposed · ops: damage, if, forEach, apply

### `shout.vigilante` — Hue and Cry
- Shout · cost Wr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies, Stealthed ones included, are Exposed for 1 turn. For 2 turns, the first Harmful skill each of them uses Condemns them once it resolves.
- applies: exposed, condemned · inline statuses: hue_and_cry · ops: apply
  - inline `hue_and_cry` (Debuff; triggers: skillResolved): The first Harmful skill the bearer uses Condemns them once it resolves.

### `withstand.vigilante` — Reinforced Trenchcoat
- Withstand · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. While it holds, each Debuff an enemy would give them is prevented and costs 10 of the Shield instead.
- applies: shield · inline statuses: reinforced_trenchcoat · ops: apply, if, eventEffect, boostShields
  - inline `reinforced_trenchcoat` (Buff; triggers: effectGained): While the bearer has Shield, Debuffs from enemies are prevented, each costing 10 Shield.

### `taunt.vigilante` — Bait and Switch
- Taunt · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. The first time they damage the user, the Taunt ends: the user gains Stealth, and they're Exposed for 2 turns.
- applies: taunt, stealth, exposed · inline statuses: bait_and_switch · ops: apply, if, removeEffect, removeSelf
  - inline `bait_and_switch` (Debuff; triggers: dealtDamage): The first time the bearer hits the applier, the Taunt ends, the applier gains Stealth, and the bearer is Exposed for 2 turns.

### `titan.vigilante` — Nightwarden
- Titan · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor, each enemy who damages them is Exposed for 1 turn, and Exposed enemies can't target or damage them.
- applies: armor, exposed · inline statuses: nightwarden · ops: apply
  - inline `nightwarden` (Buff; triggers: damaged): Each enemy who damages the bearer is Exposed for 1 turn; Exposed enemies can't target or damage the bearer.

### `bloodhound_run_down` — Run Down (minion skill of `bloodhound`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy.
- ops: damage

### `bloodhound_scent` — Scent (minion skill of `bloodhound`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Exposed for as long as the Bloodhound lives, until it uses Scent again.
- applies: exposed · inline statuses: bloodhound_scent · ops: removeEffect, apply
  - inline `bloodhound_scent` (Debuff): Exposed for as long as the Bloodhound lives, until it uses Scent again.

### `informant_tip_off` — Tip Off (minion skill of `informant`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- Its creator's next skill is Stealthy.
- inline statuses: tip_off · ops: apply
  - inline `tip_off` (Buff): The bearer's next skill is Stealthy.

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `bloodhound` — Bloodhound, 30 HP; skills: bloodhound_run_down, bloodhound_scent
- `informant` — Informant, 15 HP; skills: informant_tip_off

## Named statuses defined here (5) — this group owns their default animations

- `exposed` — Exposed (Debuff; triggers: effectGained): Can't become Stealthed, Invulnerable or Untargetable (any they have ends), and the Invisible effects they own are revealed. Vigilante skills deal them 10 more. _Applied by skills in: vigilante._
- `informant_watch` — Informant (Neutral; triggers: damaged): Whoever damages the Informant is Exposed for 2 turns. _Applied by skills in: none directly._
- `patrol_watch` — Night Patrol (watched) (Neutral; triggers: skillUsed): Tracks each Harmful skill the bearer uses. _Applied by skills in: vigilante._
- `setup_watch` — Setup (Debuff; triggers: effectGained): Any ally of the bearer who gives them a Buff is Exposed for 2 turns. _Applied by skills in: vigilante._
- `swept` — Swept (Debuff; triggers: skillResolved): Each skill the bearer uses while Condemned also Blinds them for 1 turn. _Applied by skills in: none directly._
