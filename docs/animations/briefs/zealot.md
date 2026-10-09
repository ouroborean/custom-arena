# Zealot — animation brief

Group id: `zealot`. Element(s): Holy + Unholy. Concept file: `docs/animations/concepts/zealot.yaml`.
Skill source: `packages/content/data/fusions/zealot/skills.zealot.yaml`; minions: `packages/content/data/fusions/zealot/minions.zealot.yaml`; statuses: `packages/content/data/fusions/zealot/statuses.zealot.yaml`; macros: `packages/content/data/fusions/zealot/macros.zealot.yaml`.

## Skills (33)

### `strike.zealot` — Scourge
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, +5 for each Debuff on the user. The user gains 1 Fervor.
- applies: fervor · ops: damage, apply

### `smash.zealot` — Crusader's Wrath
- Smash · cost SS · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Spends all the user's Fervor: deals 20 damage to target enemy and 10 to their allies, +10 to each hit per stack spent.
- ops: set, removeEffect, damage

### `charge.zealot` — Fanatic's Charge
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user's next skill costs 1 less for every 25 HP they're missing.
- inline statuses: fanatics_charge · ops: damage, apply
  - inline `fanatics_charge` (Buff): The bearer's next skill costs 1 less per stack.

### `riposte.zealot` — Welcome the Blow
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, who gains 2 Fervor as if it had landed. Invisible.
- applies: fervor · inline statuses: welcome_the_blow · ops: apply
  - inline `welcome_the_blow` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, who gains 2 Fervor.

### `rage.zealot` — Fanaticism
- Rage · cost A · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might. Debuffs enemies would give them are prevented and give them 1 Fervor each instead.
- applies: might, fervor · inline statuses: fanaticism · ops: apply, if, eventEffect
  - inline `fanaticism` (Buff; triggers: effectGained): Debuffs from enemies are prevented, each giving 1 Fervor instead.

### `shot.zealot` — Penitent's Flail
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user spends 1 Fervor, if they have one, to heal 15.
- ops: damage, if, removeStacks, heal

### `snipe.zealot` — Martyr's Spear
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 35 damage to target enemy, +10 for each time an enemy damages the user meanwhile (up to +30). The target of this skill is invisible. Channeled.
- inline statuses: martyrs_spear · ops: apply, if, addStacksSelf, damage
  - inline `martyrs_spear` (Neutral; triggers: damaged): When this runs out, its target takes 25 damage, +10 per stack; each enemy hit on the bearer adds a stack (max 4).

### `trap.zealot` — Inquisition
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, each skill target enemy uses gives the user 1 Fervor. When it ends, they take 5 damage for each skill they used. Invisible.
- applies: fervor · inline statuses: inquisition · ops: apply, addStacksSelf, damage
  - inline `inquisition` (Debuff, hidden; triggers: skillUsed): Each skill the bearer uses gives the applier 1 Fervor; when this ends, the bearer takes 5 damage per skill used.

### `maneuver.zealot` — Hair Shirt
- Maneuver · cost A · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user takes half damage, and each enemy hit on them gives them 2 Fervor. Invisible.
- applies: fervor · inline statuses: hair_shirt · ops: apply, if
  - inline `hair_shirt` (Buff, hidden; triggers: damaged): The bearer takes half damage, and each enemy hit gives them 2 Fervor.

### `companion.zealot` — Flagellant
- Companion · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- Summons a Flagellant (40 HP, 1 Fervor) permanently. Self-Scourge (nc): it takes 10 Affliction and gains 1 Fervor. Blood Whip (r): 10 damage, +5 per Fervor it has.
- summons: flagellant · ops: summon

### `bolt.zealot` — Eye for an Eye
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they were the last enemy to damage the user, it deals 15 more and the user gains 1 Fervor.
- applies: fervor · ops: if, damage, apply

### `blast.zealot` — Harrowing Nova
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to all enemies. The user drains a Soul Fragment from each enemy it drops from above half HP to half or below.
- applies: soul_fragment · ops: forEach, set, damage, if, apply

### `consume.zealot` — Sin Eater
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. Then the user takes every Debuff their allies have onto themselves, for the turns each had left.
- ops: damage, heal, moveEffects

### `summon.zealot` — Initiate
- Summon · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Initiate (20 HP, 1 Fervor) for 3 turns. Take the Blow (nc): the next Harmful skill aimed at target ally hits the Initiate instead.
- summons: initiate · ops: summon

### `channel.zealot` — Mortification
- Channel · cost W · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, they take 10 Affliction and gain 1 Fervor, then a random enemy takes 5 damage per Fervor stack they have. Channeled.
- applies: fervor · inline statuses: mortification · ops: apply, damage
  - inline `mortification` (Neutral; triggers: turnEnd): Each turn, the bearer takes 10 Affliction and gains 1 Fervor, then a random enemy takes 5 per Fervor.

### `stab.zealot` — Atoning Blade
- Stab · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and a random Debuff of the user's moves onto that enemy, with the time it had left.
- ops: damage, stealRandom

### `ravage.zealot` — Strip the Faithless
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 Piercing damage to target enemy. For 2 turns, each Horrified enemy loses a random Buff at the start of their turn.
- inline statuses: strip_the_faithless · ops: damage, apply, if, removeRandom
  - inline `strip_the_faithless` (Debuff; triggers: turnStart): While Horrified, the bearer loses a random Buff at the start of each of their turns.

### `mislead.zealot` — Willing Martyrs
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and each of its targets heals 10 per Fervor the user has. Invisible.
- inline statuses: willing_martyrs · ops: apply, heal
  - inline `willing_martyrs` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and its targets heal 10 per Fervor of the applier.

### `stun.zealot` — Mass Penance
- Stun · cost A · cooldown 4 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Stunned for 1 turn. The user takes 15 Affliction damage for each one Stunned.
- applies: stun · ops: apply, damage

### `dance.zealot` — Ecstasy
- Dance · cost W · cooldown 0 · target **self** · tags Helpful, Strategic
- The user spends 1 Fervor for 1 Might, 1 Swiftness and 1 Focus until the end of their next turn. With none, they gain 1 Fervor and 1 Confusion for 1 turn.
- applies: might, swiftness, focus, fervor, confusion · ops: if, removeStacks, apply

### `heal.zealot` — Give of Yourself
- Heal · cost r · cooldown 0 · target **ally** · tags Helpful, Strategic
- The user takes 15 damage and gains 1 Fervor; target ally heals 20.
- applies: fervor · ops: damage, apply, heal

### `bless.zealot` — Zealous Unction
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Fervor. For 3 turns, at the end of each of the user's turns, they heal 5 per Fervor they have.
- applies: fervor · inline statuses: zealous_unction · ops: apply, heal
  - inline `zealous_unction` (Buff; triggers: turnEnd): At the end of each of the applier's turns, the bearer heals 5 per Fervor they have.

### `curse.zealot` — Communal Grace
- Curse · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Sanctified for 2 turns. Meanwhile, whenever their Sanctify triggers, every other ally of the damager heals 5 too.
- applies: sanctify · inline statuses: communal_grace · ops: apply, if, heal
  - inline `communal_grace` (Debuff; triggers: damaged): While Sanctified, a direct hit on the bearer also heals the damager's other allies 5.

### `smite.zealot` — Unguarded Wrath
- Smite · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy. The user is Sanctified for 1 turn.
- applies: sanctify · ops: damage, apply

### `prayer.zealot` — Fervent Chant
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 25. Any ally who dies before the user's next turn is a Martyr as if they had 3 Fervor.
- applies: fervent_chant · ops: heal, apply

### `cleave.zealot` — Heretics' Circle
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy, and 15 to each other enemy with a Debuff, if the target has one too.
- ops: set, damage, if

### `shout.zealot` — Sermon of Dread
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For 2 turns, each Buff an enemy would gain is lost, and the user gains 1 Fervor for it.
- applies: fervor · inline statuses: sermon_of_dread · ops: apply, eventEffect
  - inline `sermon_of_dread` (Debuff; triggers: effectGained): Each Buff the bearer would gain is lost, and the applier gains 1 Fervor for it.

### `withstand.zealot` — Hardened Faith
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- For 1 turn, after each enemy hit on the user lands, they gain 15 Shield for 1 turn.
- applies: shield · inline statuses: hardened_faith · ops: apply
  - inline `hardened_faith` (Buff; triggers: damaged): After each enemy hit on the bearer, they gain 15 Shield for 1 turn.

### `taunt.zealot` — Strike Me Down
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. If the user is killed meanwhile, their killer takes 10 Affliction damage per Fervor stack the user had.
- applies: taunt · inline statuses: strike_me_down · ops: apply, damage
  - inline `strike_me_down` (Buff): If the bearer is killed, the killer takes 10 Affliction per Fervor the bearer had.

### `titan.zealot` — Living Saint
- Titan · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Immune. When it ends, they count as a Martyr without dying: their allies gain the Martyr effect for the user's Fervor, which is then spent.
- applies: armor, immune · inline statuses: living_saint · macros: martyr_payout · ops: apply, macro, removeEffect
  - inline `living_saint` (Buff): When this ends, the bearer's allies gain the Martyr effect for the bearer's Fervor, which is then spent.

### `flagellant_self_scourge` — Self-Scourge (minion skill of `flagellant`)
- Minion · cost free · cooldown 0 · target **self** · tags Helpful, Strategic
- The Flagellant takes 10 Affliction damage and gains 1 Fervor.
- applies: fervor · ops: damage, apply

### `flagellant_blood_whip` — Blood Whip (minion skill of `flagellant`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, +5 per Fervor the Flagellant has.
- ops: damage

### `initiate_take_the_blow` — Take the Blow (minion skill of `initiate`)
- Minion · cost free · cooldown 0 · target **ally** · tags Helpful, Strategic
- The next single-target Harmful skill aimed at target ally hits the Initiate instead.
- applies: take_the_blow · ops: apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `flagellant` — Flagellant, 40 HP; skills: flagellant_self_scourge, flagellant_blood_whip
- `initiate` — Initiate, 20 HP; skills: initiate_take_the_blow

## Named statuses defined here (4) — this group owns their default animations

- `fervor` — Fervor (Buff; triggers: damaged, effectGained): +5 damage per stack to the bearer's Zealot skills (max 5). +1 whenever an enemy damages the bearer or gives them a Debuff. Martyr: when the bearer dies, each of their allies heals 10 per stack and gains 1 Might per 2. _Applied by skills in: zealot._
- `fervent_chant` — Fervent Chant (Buff): If the bearer dies, they're a Martyr as if they had 3 Fervor. _Applied by skills in: zealot._
- `take_the_blow` — Take the Blow (Buff): The next single-target enemy skill aimed at the bearer hits the Initiate instead. _Applied by skills in: zealot._
- `unction_shield` — Unction (Buff): Absorbs damage. _Applied by skills in: none directly._

## Macros defined here (2) — this group owns their default animations

- `martyr`: ops set, heal, if, apply; applies might. _Used by: none directly._
- `martyr_payout`: ops heal, if, apply; applies might. _Used by: zealot._
