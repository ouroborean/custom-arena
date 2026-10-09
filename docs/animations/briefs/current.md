# Current — animation brief

Group id: `current`. Element(s): Water + Lightning. Concept file: `docs/animations/concepts/current.yaml`.
Skill source: `packages/content/data/fusions/current/skills.current.yaml`; minions: `packages/content/data/fusions/current/minions.current.yaml`; statuses: `packages/content/data/fusions/current/statuses.current.yaml`; macros: `packages/content/data/fusions/current/macros.current.yaml`.

## Skills (33)

### `strike.current` — Shock Palm
- Strike · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, then they're Soaked for 2 turns. The user gains 1 Charge for each other enemy the hit conducts to.
- applies: soaked, charged · ops: set, damage, apply

### `smash.current` — Breakdown Surge
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies. Each of them who has Shield or Armor takes 10 Affliction damage at the start of the user's next turn.
- inline statuses: breakdown_surge · ops: apply, damage
  - inline `breakdown_surge` (Debuff): 10 Affliction damage at the start of the applier's next turn.

### `charge.current` — Rip Current
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user gains 1 Focus, and their next skill Soaks the enemies it targets for 2 turns before it hits.
- applies: focus, soaked · inline statuses: rip_current · ops: damage, apply
  - inline `rip_current` (Buff; triggers: skillUsed): The bearer's next skill Soaks its enemy targets before it hits.

### `riposte.current` — Still Water
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user; its user is Soaked for 2 turns, then takes 15 damage, which conducts. Invisible.
- applies: soaked · inline statuses: still_water · macros: conduct · ops: apply, damage, set, forEach, macro
  - inline `still_water` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; their users are Soaked for 2 turns, then take 15 damage, which conducts.

### `rage.current` — Galvanic Fury
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Immune, and their single-target hits conduct through Sapped enemies as if they were Soaked.
- applies: might, immune · inline statuses: galvanic_fury · ops: apply, if, damage
  - inline `galvanic_fury` (Buff; triggers: dealtDamage): The bearer's single-target hits conduct through Sapped enemies.

### `shot.current` — Spark Spray
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who is Soaked for 2 turns. If the user is Charged, they spend 1 Charge to Soak a random other enemy for 2 turns too.
- applies: soaked · ops: damage, apply, if, removeStacks

### `snipe.current` — Conductor's Lance
- Snipe · cost Ir · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy, which conducts if they're Soaked; the user gains 1 Charge per other Soaked enemy. The target of this skill is invisible. Channeled.
- applies: charged · inline statuses: conductors_lance · ops: apply, damage
  - inline `conductors_lance` (Neutral): Strikes its target at the end of the following turn; the hit conducts.

### `trap.current` — Live Wire
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time target enemy uses a Harmful skill, every enemy is Soaked for 2 turns, then takes 10 damage. Invisible.
- applies: soaked · inline statuses: live_wire · ops: apply, damage
  - inline `live_wire` (Debuff, hidden; triggers: skillUsed): The first time the bearer uses a Harmful skill, they and each of their allies are Soaked for 2 turns, then take 10 damage.

### `maneuver.current` — Submerge
- Maneuver · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn and gains 1 Charge. When it ends, they spend all their Charge: a random enemy is Soaked for 2 turns, then each Soaked enemy takes 10 damage per Charge spent.
- applies: invulnerable, charged, soaked · inline statuses: submerge · ops: apply, set, removeEffect, damage
  - inline `submerge` (Buff): When this ends, the bearer spends all their Charge: a random enemy is Soaked, then each Soaked enemy takes 10 damage per Charge spent.

### `companion.current` — Electric Eel
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Electric Eel (30 HP) permanently. Eel Shock (r): 10 damage and Soaked for 2 turns. Static Coil (I): target ally gains 1 Charge per Soaked enemy (max 3).
- summons: electric_eel · ops: summon

### `bolt.current` — Galvanic Bolt
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Target enemy is Soaked for 2 turns, then takes 20 damage. Every enemy it conducts to is Sapped.
- applies: soaked, sapped · ops: apply, damage

### `blast.current` — Deluge of Sparks
- Blast · cost II · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies, who are Soaked for 2 turns. The user's next skill costs 1 less.
- applies: soaked, focus · ops: damage, apply

### `consume.current` — Ebb Siphon
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, who is Sapped. The user then heals 10 per stack of Sapped on them (max 30).
- applies: sapped · ops: damage, apply, heal

### `summon.current` — Galvanic Elemental
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Galvanic Elemental (20 HP) for 3 turns. When it dies, every Soaked enemy takes 15 damage. Static Lash (nc, Uncounterable): 10 damage and Soaked for 1 turn.
- summons: galvanic_elemental · ops: summon

### `channel.current` — Electric Rain
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 4 turns, at the end of each of the user's turns, a random enemy is Soaked for 2 turns, then a random Soaked enemy takes 10 damage, which conducts. Channeled.
- applies: soaked · inline statuses: electric_rain · macros: conduct · ops: apply, forEach, damage, set, macro
  - inline `electric_rain` (Neutral; triggers: turnEnd): At the end of each of the bearer's turns, a random enemy is Soaked, then a random Soaked enemy takes 10 damage, which conducts.

### `stab.current` — Static Shiv
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. For 1 turn, the user gains 1 Charge each time an enemy skill targets them.
- applies: charged · inline statuses: static_shiv · ops: damage, apply
  - inline `static_shiv` (Buff; triggers: skillTargeted): Each enemy skill that targets the bearer gives them 1 Charge.

### `ravage.current` — Riptide Pike
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. If they're Soaked, the user's other cooldowns drop by 1; if not, they're Soaked for 2 turns.
- applies: soaked · ops: set, damage, if, adjustCooldowns, apply

### `mislead.current` — Grounding
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and they're Soaked for 2 turns and Sapped. Invisible.
- applies: soaked, sapped · inline statuses: grounding · ops: apply
  - inline `grounding` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they're Soaked and Sapped.

### `stun.current` — Electric Undertow
- Stun · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Stuns them for 1 turn. Every other Soaked enemy has their non-Strategic skills stunned for 1 turn.
- applies: stun, stun_ns · ops: damage, apply

### `dance.current` — Eelskin Waltz
- Dance · cost Ar · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness, and Soaked enemies can't target or damage them. Each enemy who damages them meanwhile is Soaked for 2 turns.
- applies: swiftness, soaked · inline statuses: eelskin_waltz · ops: apply
  - inline `eelskin_waltz` (Buff; triggers: damaged): Soaked enemies can't target or damage the bearer; each enemy who damages them is Soaked.

### `heal.current` — Still Spring
- Heal · cost I · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20 and gains 2 Renew. For 2 turns, their Renew heals without losing stacks.
- applies: renew · inline statuses: still_spring · ops: heal, apply
  - inline `still_spring` (Buff): The bearer's Renew doesn't lose stacks (see Renew).

### `bless.current` — Overflow
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally's single-target skills count as Current skills: they Soak the enemy they target for 2 turns before they hit, deal 5 more to Soaked enemies and conduct through them.
- applies: soaked · inline statuses: overflow · ops: apply, if
  - inline `overflow` (Buff; triggers: skillUsed): The bearer's single-target skills Soak their enemy target before they hit; their skills deal 5 more to Soaked enemies, and their single-target hits conduct.

### `curse.current` — Waterlogged
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Soaked for 2 turns and gains 1 Confusion; each time a conducted hit reaches them, they gain 1 more (max 3).
- applies: soaked, confusion · inline statuses: waterlogged · ops: apply, if
  - inline `waterlogged` (Debuff; triggers: damaged): Each conducted hit that reaches the bearer gives them 1 more Confusion (max 3).

### `smite.current` — Closed Circuit
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each time an ally of the user damages them, every ally of the user heals 10.
- inline statuses: closed_circuit · ops: damage, apply, heal
  - inline `closed_circuit` (Debuff; triggers: damaged): Each time the applier's side damages the bearer, every ally of the applier heals 10.

### `prayer.current` — Swelling Current
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 10. The healing repeats at the start of each of the user's next 2 turns, 10 more each time (20, then 30), and stops once the user takes damage.
- inline statuses: swelling_current · ops: heal, setCounter, apply, removeSelf
  - inline `swelling_current` (Buff; triggers: turnStart, damaged): At the start of each of the bearer's next 2 turns, all their allies heal 10 more than the last time (20, then 30). Ends once the bearer takes damage.

### `cleave.current` — Arc Lash
- Cleave · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Target enemy is linked to a random other enemy until the end of the turn: each direct hit on either one also deals 10 damage to the other. Then the target takes 25 damage.
- applies: arc_lash · ops: forEach, apply, damage

### `shout.current` — Sounding Call
- Shout · cost I · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Soaked for 2 turns, and Intimidated for 1 turn per stack of Sapped they have (at least 1).
- applies: soaked, intimidated · ops: apply, forEach

### `withstand.current` — Bubble Cage
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. When it ends, they gain 1 Charge per 10 Shield left.
- applies: charged · inline statuses: bubble_cage · ops: apply
  - inline `bubble_cage` (Buff): A Shield; what's left when it ends becomes Charge, 1 per 10.

### `taunt.current` — Backwash Lure
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. Meanwhile, each time the user is healed, the Taunted enemy takes as much damage.
- applies: taunt · inline statuses: backwash_lure · ops: apply, damage
  - inline `backwash_lure` (Buff; triggers: healed): Each time the bearer is healed, the enemy they Taunted takes as much damage.

### `titan.current` — Dynamo Form
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Immune, and their player generates 1 extra energy each turn. At the end of each of those turns, the user takes 15 Affliction damage.
- applies: armor, immune · inline statuses: dynamo_form · ops: apply, damage
  - inline `dynamo_form` (Buff; triggers: turnEnd): 1 extra energy each turn; 15 Affliction to the bearer at the end of each of their turns.

### `electric_eel_shock` — Eel Shock (minion skill of `electric_eel`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who is Soaked for 2 turns.
- applies: soaked · ops: damage, apply

### `electric_eel_static_coil` — Static Coil (minion skill of `electric_eel`)
- Minion · cost I · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Charge per Soaked enemy (max 3).
- applies: charged · ops: apply

### `galvanic_elemental_static_lash` — Static Lash (minion skill of `galvanic_elemental`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic, Uncounterable
- Deals 10 damage to target enemy, who is Soaked for 1 turn. Uncounterable.
- applies: soaked · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `electric_eel` — Electric Eel, 30 HP; skills: electric_eel_shock, electric_eel_static_coil
- `galvanic_elemental` — Galvanic Elemental, 20 HP; skills: galvanic_elemental_static_lash

## Named statuses defined here (3) — this group owns their default animations

- `soaked` — Soaked (Debuff; triggers: damaged): Takes 5 more damage from Current skills. When a single-target Current skill damages the bearer, the hit conducts: every other Soaked unit on their side takes the same damage. _Applied by skills in: current._
- `current_conductor` — Conductor (Neutral): This character's Current skills deal 5 more damage to Soaked units. _Applied by skills in: none directly._
- `arc_lash` — Arc Lash (Debuff; triggers: damaged): Each direct hit on the bearer also deals 10 damage to the enemy they're linked to. _Applied by skills in: current._

## Macros defined here (1) — this group owns their default animations

- `conduct`: ops if, damage. _Used by: current._
