# Holy — animation brief

Group id: `holy`. Element(s): Holy. Concept file: `docs/animations/concepts/holy.yaml`.
Skill source: `packages/content/data/holy/skills.holy.yaml`; minions: `packages/content/data/holy/minions.holy.yaml`; statuses: `packages/content/data/holy/statuses.holy.yaml`.

## Skills (33)

### `strike.holy` — Righteous Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the user is Anointed, deals an additional 10 damage and heals the user for 10.
- ops: damage, if, heal

### `smash.holy` — Divine Storm
- Smash · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 damage to their allies. Heals the user for 5 health per target hit.
- ops: damage, set, heal

### `charge.holy` — Zealous Rush
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user's next Harmful skill Sanctifies its targets for 1 turn.
- applies: sanctify · inline statuses: zealous_rush · ops: damage, apply
  - inline `zealous_rush` (Buff; triggers: skillResolved): The bearer's next Harmful skill Sanctifies its targets for 1 turn.

### `riposte.holy` — Retribution
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- For 1 turn, any Harmful skill received by the user will heal instead of damage.
- inline statuses: retribution · ops: apply
  - inline `retribution` (Buff): Direct damage from enemies heals the bearer instead.

### `rage.holy` — Divine Fury
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Anointed for the next 3 turns.
- applies: anointed · ops: apply

### `shot.holy` — Sunbeam
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. Consumes Anointed on the user to heal them for 15.
- ops: damage, if, removeEffect, heal

### `snipe.holy` — Spear of Light
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user deals 50 damage to target enemy on the following turn. The target of this skill is invisible. Channeled.
- inline statuses: spear_of_light · ops: apply, damage
  - inline `spear_of_light` (Neutral): Fires at the end of the following turn unless the user is stunned, dies or uses another skill.

### `trap.holy` — Decree
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Condemned for 2 turns.
- applies: condemned · ops: apply

### `maneuver.holy` — Cloister
- Maneuver · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains Immune for 1 turn. If they are Anointed, this skill also grants Invulnerable.
- applies: immune, invulnerable · ops: apply, if

### `companion.holy` — Sacred Lion
- Companion · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- Summons a Sacred Lion minion (45 HP). Sanctified Roar: 10 damage to all enemies and Sanctifies them. Claws of the Church: 15 damage, 10 more against Sanctified enemies.
- summons: sacred_lion · ops: summon

### `bolt.holy` — Rebuke
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Sanctifies them for 1 turn.
- applies: sanctify · ops: damage, apply

### `blast.holy` — Holy Nova
- Blast · cost IW · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to all enemies. If the user is Anointed, this skill strikes again at the start of the user's next turn.
- inline statuses: holy_nova · ops: damage, if, apply
  - inline `holy_nova` (Neutral; triggers: turnStart): Deals 25 Piercing damage to all enemies at the start of the user's next turn.

### `consume.holy` — Ascension
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. If that enemy is Sanctified, the user is permanently Anointed; otherwise, the enemy is Sanctified for 1 turn and the user is Anointed until the end of the user's next turn.
- applies: anointed, sanctify · ops: set, damage, if, apply

### `summon.holy` — Divine Blessing
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Divine Blessing minion (10 HP) for 3 turns. Blessing from Above (W): Anoints target ally, then the Divine Blessing dies.
- summons: divine_blessing · ops: summon

### `channel.holy` — Consecration
- Channel · cost W · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- At the end of each of the user's turns, deals 10 damage to a random enemy not affected by Sanctify and Sanctifies them. Channeled.
- applies: sanctify · inline statuses: consecration · ops: apply, damage
  - inline `consecration` (Neutral; triggers: turnEnd): Each end of the user's turn, 10 damage to a random un-Sanctified enemy and Sanctifies them. Lasts until interrupted.

### `stab.holy` — Piercing Light
- Stab · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If the target is Condemned or Sanctified, this skill deals an additional 10 damage. If the user is Anointed, the bonus always applies.
- ops: if, signal, damage

### `ravage.holy` — Crusade
- Ravage · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy. If the target is above 75 health, they are Condemned.
- applies: condemned · ops: set, damage, if, apply

### `mislead.holy` — Martyrdom
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, all targets of that skill will be permanently Anointed, if not already. Invisible.
- applies: anointed · inline statuses: martyrdom · ops: apply
  - inline `martyrdom` (Debuff, hidden; triggers: skillUsed): When the bearer uses a Harmful skill, its targets are permanently Anointed.

### `stun.holy` — Repentance
- Stun · cost r · cooldown 1 · target **enemy** · tags Harmful, Strategic
- Target enemy is Condemned for 1 turn. If they're already Condemned, they're Stunned for 1 turn instead.
- applies: stun, condemned · ops: if, apply

### `dance.holy` — Angel's Grace
- Dance · cost WW · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Invulnerable, Immune, and Ghosted.
- applies: invulnerable, immune, ghosted · ops: apply

### `heal.holy` — Hand of Light
- Heal · cost Wr · cooldown 3 · target **ally** · tags Helpful, Strategic
- Heals target ally for 50.
- ops: heal

### `bless.holy` — Holy Favor
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally is Anointed until the end of their next turn.
- applies: anointed · ops: apply

### `curse.holy` — Mark of Heresy
- Curse · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Condemned and Sanctified until the end of the user's next turn.
- applies: condemned, sanctify · ops: apply

### `smite.holy` — Karmic Marking
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the user is Anointed, the target is Sanctified for 2 turns.
- applies: sanctify · ops: damage, if, apply

### `prayer.holy` — Saving Grace
- Prayer · cost SW · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- Heals allies for 10 health and grants them 10 Shield. If the user is Anointed, this repeats at the start of the user's next two turns.
- applies: shield · inline statuses: saving_grace · ops: heal, apply, if
  - inline `saving_grace` (Buff; triggers: turnStart): At the start of the user's turn, heals all allies 10 and grants them 10 Shield.

### `cleave.holy` — Guardian Strike
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and an additional random enemy. If a Sanctified target is struck by this skill, all allies are healed for 5 health.
- ops: set, damage, if, heal

### `shout.holy` — Excoriate
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic, Bypass
- Sanctified enemies are Condemned for 1 turn, and every other enemy is Sanctified for 1 turn. This skill Bypasses.
- applies: condemned, sanctify · ops: forEach, if, apply

### `withstand.holy` — Shield of Faith
- Withstand · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield. If they are Anointed, they also gain Immune for 2 turns.
- applies: shield, immune · ops: apply, if

### `taunt.holy` — Gleam
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted and Condemned until they use a new Harmful skill.
- applies: taunt, condemned · ops: apply

### `titan.holy` — Grand Crusader
- Titan · cost Wr · cooldown 4 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies and Sanctifies them for 1 turn. For 3 turns, the user gains 2 Might and 2 Armor.
- applies: sanctify, might, armor · ops: damage, apply

### `lion_roar` — Sanctified Roar (minion skill of `sacred_lion`)
- Minion · cost W · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies and afflicts them with Sanctify.
- applies: sanctify · ops: damage, apply

### `lion_claws` — Claws of the Church (minion skill of `sacred_lion`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, 10 more to enemies affected by Sanctify.
- ops: damage

### `blessing_from_above` — Blessing from Above (minion skill of `divine_blessing`)
- Minion · cost W · cooldown 0 · target **ally** · tags Helpful, Strategic
- Anoints target ally. The Divine Blessing then dies.
- applies: anointed · ops: apply, kill

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `sacred_lion` — Sacred Lion, 45 HP; skills: lion_roar, lion_claws
- `divine_blessing` — Divine Blessing, 10 HP; skills: blessing_from_above

## Named statuses defined here (2) — this group owns their default animations

- `anointed` — Anointed (Buff): No effect on its own. Many Holy skills do more while their user is Anointed, and some consume it. _Applied by skills in: anointment, antidote, divine, phoenix, vengeance, holy._
- `condemned` — Condemned (Debuff; triggers: skillUsed): The next time the bearer uses a skill, they randomly receive 1 Weakness, 1 Vulnerable or 1 Confusion, and Condemn is removed. _Applied by skills in: angel, anointment, antidote, divine, prism, sanctuary, vengeance, vigilante, holy._
