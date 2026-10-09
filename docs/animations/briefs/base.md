# Base (elementless) — animation brief

Group id: `base`. Element(s): None. Concept file: `docs/animations/concepts/base.yaml`.
Skill source: `packages/content/data/base/skills.yaml`; minions: `packages/content/data/base/minions.yaml`; statuses: `packages/content/data/base/statuses.yaml`.

## Skills (30)

### `strike` — Strike
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and gains 1 Might.
- applies: might · ops: damage, apply

### `smash` — Smash
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 damage to their allies.
- ops: damage

### `charge` — Charge
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and gives the user 1 Focus for their next skill.
- applies: focus · ops: damage, apply

### `riposte` — Riposte
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user will counter any Harmful skill used on them, dealing 15 damage to its user. Invisible.
- inline statuses: riposte · ops: apply, damage
  - inline `riposte` (Buff, hidden; triggers: skillTargeted/counter): Counters any Harmful skill used on the bearer, dealing 15 damage to its user.

### `rage` — Rage
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might and Immune.
- applies: might, immune · ops: apply

### `shot` — Shot
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy.
- ops: damage

### `snipe` — Snipe
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user deals 50 damage to target enemy on the following turn. The target of this skill is invisible. Channeled.
- inline statuses: snipe · ops: apply, damage
  - inline `snipe` (Neutral): Fires at the end of the following turn unless the user is stunned, dies or uses another skill.

### `trap` — Trap
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, target enemy gains Trap 15. Invisible.
- applies: trap · ops: apply

### `maneuver` — Maneuver
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn.
- applies: invulnerable · ops: apply

### `companion` — Companion
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Wolf minion permanently. It deals 10 damage to a random enemy each turn.
- summons: wolf · ops: summon

### `bolt` — Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and Marks them for 1 turn.
- applies: mark · ops: damage, apply

### `blast` — Blast
- Blast · cost II · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 35 damage to all enemies.
- ops: damage

### `consume` — Consume
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, restoring health equal to the damage dealt. If the target is Marked or affected by a Curse skill, this skill heals an additional 10 HP.
- ops: set, damage, heal

### `summon` — Summon
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Arcane Familiar for 3 turns that deals 15 damage to a random enemy each turn.
- summons: arcane_familiar · ops: summon

### `channel` — Channel
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Deals 10 damage to all enemies for 2 turns. If any target damaged by this skill is Marked, an additional turn is added to the duration. Channeled.
- inline statuses: channel · ops: apply, damage, if, extendSelf, setFlag
  - inline `channel` (Neutral; triggers: turnEnd): Deals 10 damage to all enemies at the end of each of the user's turns.

### `stab` — Stab
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, increased to 20 against targets at or below 60 health.
- ops: if, signal, damage

### `ravage` — Ravage
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. Against Stunned targets, deals 15 additional damage.
- ops: damage

### `mislead` — Mislead
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, they will be countered. Invisible.
- inline statuses: mislead · ops: apply
  - inline `mislead` (Debuff, hidden; triggers: skillUsed/counter): Harmful skills used by the bearer are countered.

### `stun` — Stun
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Stuns them for 1 turn.
- applies: stun · ops: damage, apply

### `dance` — Dance
- Dance · cost AI · cooldown 5 · target **self** · tags Helpful, Strategic
- The user gains 1 Might, 2 Swiftness, and 1 Focus for 4 turns.
- applies: might, swiftness, focus · ops: apply

### `heal` — Heal
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Heals target ally 25 HP.
- ops: heal

### `bless` — Bless
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might and 1 Renew.
- applies: might, renew · ops: apply

### `curse` — Curse
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns.
- applies: confusion · ops: apply

### `smite` — Smite
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Sanctifies them for 1 turn.
- applies: sanctify · ops: damage, apply

### `prayer` — Prayer
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- Heals all allies for 30 health and grants them 10 Shield.
- applies: shield · ops: heal, apply

### `cleave` — Cleave
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 damage to a second random enemy.
- ops: damage

### `shout` — Shout
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns.
- applies: intimidated · ops: apply

### `withstand` — Withstand
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn.
- applies: shield · ops: apply

### `taunt` — Taunt
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns.
- applies: taunt · ops: apply

### `titan` — Titan
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 3 Armor and Immune.
- applies: armor, immune · ops: apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `wolf` — Wolf, 30 HP; skills: none
  - passive `wolf_bite` (triggers: turnEnd): Deals 10 damage to a random enemy at the end of its owner's turn.
- `arcane_familiar` — Arcane Familiar, 20 HP; skills: none
  - passive `arcane_bolt` (triggers: turnEnd): Deals 15 damage to a random enemy at the end of its owner's turn.

## Named statuses defined here (24) — this group owns their default animations

- `might` — Might (Buff): +5 direct damage dealt per stack. _Applied by skills in: base, earth, fire, alchemy, angel, anointment, antidote, apocalypse, assassin, battery, blight, blood, brimstone, cloud, crystal, current, curse, devil, dimension, dragon, evolution, faerie, ghost, glacier, grave, ion, lich, life, magnet, mechanic, mirror, mist, moon, myth, night, ninja, nomad, ocean, phoenix, plasma, reanimation, ritual, sanctuary, serum, slime, spore, stasis, storm, thunder, vengeance, vigilante, winter, zealot, holy, poison, shadow, water, wind._
- `weakness` — Weakness (Debuff): −5 direct damage dealt per stack. _Applied by skills in: earth, fire, alchemy, devil, divine, evolution, life, mist, moon, phoenix, sanctuary, vengeance, poison, unholy, water, wind._
- `vulnerable` — Vulnerable (Debuff): +5 direct damage taken per stack. _Applied by skills in: fire, assassin, devil, divine, dragon, evolution, magnet, ocean, phoenix, sanctuary, spore, vengeance, poison, unholy, water._
- `armor` — Armor (Buff): −5 Normal damage taken per stack. _Applied by skills in: base, earth, alchemy, angel, anointment, antidote, apocalypse, assassin, blight, blood, current, dimension, divine, evil, evolution, grave, ion, lich, life, magnet, mirror, moon, myth, nomad, ocean, prism, reanimation, sanctuary, serum, slime, spore, thunder, vengeance, vigilante, winter, zealot, holy, ice, lightning, poison, shadow, unholy, water._
- `shield` — Shield (Buff): Absorbs Normal and Piercing damage until depleted. _Applied by skills in: base, earth, fire, angel, anointment, antidote, apocalypse, aurora, battery, blight, crystal, dimension, divine, dragon, evil, glacier, grave, magnet, mist, night, ninja, nomad, plasma, prism, reanimation, sanctuary, slime, stasis, storm, vengeance, vigilante, winter, zealot, holy, ice, poison, unholy, water, wind._
- `stun` — Stunned (Debuff): Cannot use skills. _Applied by skills in: base, earth, alchemy, angel, anointment, apocalypse, assassin, aurora, battery, blight, blood, cloud, crystal, current, curse, devil, evil, evolution, ghost, glacier, grave, ion, lich, life, magnet, mechanic, mirror, mist, myth, night, ninja, nomad, ocean, phoenix, plasma, prism, reanimation, ritual, sanctuary, serum, spore, stasis, storm, sun, vengeance, vigilante, winter, zealot, holy, ice, poison, unholy, water, wind._
- `stun_ns` — Stunned (non-Strategic) (Debuff): Cannot use non-Strategic skills (skills that deal direct damage). _Applied by skills in: fire, cloud, current, moon, ocean, plasma, vengeance, lightning, water, wind._
- `stun_s` — Stunned (Strategic) (Debuff): Cannot use Strategic skills. _Applied by skills in: moon, thunder, wind._
- `sleep` — Sleep (Debuff; triggers: damaged): Stunned. Ends when the bearer takes damage. _Applied by skills in: antidote, curse, dragon, evolution, moon, ninja, vigilante, shadow._
- `invulnerable` — Invulnerable (Buff): Cannot be targeted by enemy skills, and takes no damage from enemy triggered or ticking effects unless that damage is Affliction or Bypassing. _Applied by skills in: base, earth, fire, alchemy, angel, anointment, antidote, apocalypse, assassin, aurora, battery, blight, brimstone, cloud, current, curse, divine, dragon, evolution, glacier, grave, ion, life, magnet, mechanic, mist, moon, myth, ninja, ocean, plasma, prism, reanimation, ritual, sanctuary, serum, slime, spore, stasis, sun, thunder, vengeance, vigilante, holy, ice, lightning, poison, water._
- `ghosted` — Ghosted (Buff): The bearer's skills Bypass (ignore Invulnerable and Isolated). _Applied by skills in: earth, assassin, dimension, holy, shadow, wind._
- `untargetable` — Untargetable (Buff): Cannot be targeted by enemy skills, but still takes triggered and ticking damage. _Applied by skills in: curse, life, lightning._
- `isolated` — Isolated (Debuff): Cannot be targeted by allied skills. _Applied by skills in: earth, assassin, cloud, curse, dimension, mechanic, moon, nomad, ritual, sanctuary, shadow, wind._
- `shattered` — Shattered (Debuff): Gets no benefit from Armor or Shield. _Applied by skills in: anointment, apocalypse, crystal._
- `swiftness` — Swiftness (Buff): Ignores the next Stun effect applied (consumes one stack). _Applied by skills in: base, alchemy, angel, anointment, antidote, apocalypse, assassin, aurora, battery, blight, blood, brimstone, cloud, crystal, current, curse, devil, dragon, evolution, faerie, ghost, glacier, ion, lich, life, magnet, mirror, mist, moon, myth, night, ninja, phoenix, reanimation, ritual, slime, spore, stasis, storm, sun, thunder, vengeance, vigilante, winter, zealot, lightning, poison, shadow, water, wind._
- `intimidated` — Intimidated (Debuff): Cooldowns increased by 1 per stack. _Applied by skills in: base, anointment, antidote, apocalypse, battery, blight, blood, cloud, crystal, current, curse, dragon, evolution, ghost, grave, ion, lich, magnet, mechanic, mirror, mist, myth, night, ninja, plasma, reanimation, sanctuary, sun, vengeance, winter, lightning, shadow._
- `focus` — Focus (Buff): Reduces skill costs by 1 GEN per stack. All of it ends once the bearer uses a skill. _Applied by skills in: base, alchemy, anointment, antidote, apocalypse, assassin, blight, brimstone, cloud, current, devil, dimension, divine, dragon, evolution, faerie, ion, lich, mist, myth, night, plasma, ritual, sanctuary, spore, thunder, vengeance, zealot, poison, shadow, water._
- `confusion` — Confusion (Debuff): Increases skill costs by 1 GEN per stack. All of it ends once the bearer uses a skill. _Applied by skills in: base, alchemy, antidote, apocalypse, assassin, aurora, battery, blight, brimstone, current, devil, dimension, divine, evil, evolution, faerie, grave, ion, life, mechanic, mirror, mist, myth, nomad, ocean, phoenix, sanctuary, slime, stasis, vengeance, zealot, poison, shadow, unholy, water._
- `mark` — Mark (Debuff; triggers: damaged): When the bearer takes direct damage, they take 10 more damage and the Mark is consumed. _Applied by skills in: base, assassin, brimstone, cloud, divine, mechanic, ninja, reanimation, vengeance, lightning, poison, water, wind._
- `taunt` — Taunted (Debuff): Can only target the source of the Taunt. _Applied by skills in: base, fire, alchemy, angel, anointment, antidote, apocalypse, assassin, aurora, battery, blight, blood, brimstone, cloud, crystal, current, curse, devil, dimension, divine, dragon, evil, evolution, faerie, glacier, grave, ion, lich, life, magnet, mechanic, mirror, moon, myth, night, ninja, nomad, ocean, phoenix, plasma, prism, reanimation, ritual, sanctuary, serum, slime, spore, stasis, storm, sun, thunder, vengeance, vigilante, zealot, holy, ice, poison, shadow, unholy, water, wind._
- `immune` — Immune (Buff): Cannot have Debuffs applied. _Applied by skills in: base, earth, fire, alchemy, angel, apocalypse, aurora, battery, blight, brimstone, cloud, crystal, current, curse, devil, dimension, divine, dragon, evolution, faerie, glacier, grave, life, mechanic, mist, myth, night, ninja, nomad, phoenix, plasma, prism, reanimation, ritual, sanctuary, slime, spore, stasis, storm, sun, thunder, vengeance, winter, zealot, holy, ice, shadow, wind._
- `trap` — Trap (Debuff; triggers: skillUsed): The bearer takes X damage the next time they use a Harmful skill. _Applied by skills in: base._
- `sanctify` — Sanctify (Debuff; triggers: damaged): When the bearer takes direct damage, the damager heals 15 HP. _Applied by skills in: base, angel, apocalypse, divine, lich, moon, night, prism, sanctuary, serum, vengeance, zealot, holy, shadow._
- `renew` — Renew (Buff; triggers: turnEnd): At the end of the applier's turn, heals 5 HP per stack, then loses 1 stack. _Applied by skills in: base, earth, alchemy, angel, antidote, battery, current, glacier, mist, moon, night, ocean, phoenix, serum, slime, poison, water._
