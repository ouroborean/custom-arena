# Divine — animation brief

Group id: `divine`. Element(s): Holy + Holy. Concept file: `docs/animations/concepts/divine.yaml`.
Skill source: `packages/content/data/fusions/divine/skills.divine.yaml`; minions: `packages/content/data/fusions/divine/minions.divine.yaml`; statuses: `packages/content/data/fusions/divine/statuses.divine.yaml`; macros: `packages/content/data/fusions/divine/macros.divine.yaml`.

## Skills (32)

### `strike.divine` — Hand of Heaven
- Strike · cost S · cooldown 0 · target **any** · tags Radiant, NonStrategic
- Radiant. Enemy: 20 damage. Ally: heals 20. If its last use was on the other side, 10 more, and the user is Anointed until the end of their next turn.
- applies: anointed · ops: set, if, damage, heal, setCounter, apply

### `smash.divine` — Heaven's Hammer
- Smash · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies. If the user is Exalted, it's spent, and every ally also heals 25.
- ops: damage, if, removeEffect, heal

### `charge.divine` — Crusader's Advance
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user gets 1 Focus for their next skill. If the target is Condemned, it triggers now, and the user is Anointed until the end of their next turn.
- applies: focus, weakness, vulnerable, confusion, anointed · ops: damage, apply, if, removeEffect, random

### `riposte.divine` — Absolution
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, and the ally with the least HP heals 20. Invisible.
- inline statuses: absolution · ops: apply, heal
  - inline `absolution` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; the bearer's ally with the least HP heals 20.

### `rage.divine` — Apotheosis
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, each time the user deals direct damage to an enemy, the ally with the least HP heals half as much; each time the user heals someone, that healing included, a random enemy takes half as much.
- inline statuses: apotheosis · ops: apply, heal, damage
  - inline `apotheosis` (Buff; triggers: dealtDamage, healDone): The bearer's direct damage to enemies heals the ally with the least HP for half as much; their healing deals half as much damage to a random enemy.

### `shot.divine` — Lightray
- Shot · cost r · cooldown 0 · target **any** · tags Radiant, NonStrategic
- Radiant. Enemy: 15 damage; until the user's next turn, allies who damage them heal 5. Ally: heals 15; until then, enemies who damage them are Condemned.
- macros: lightray_enemy_it, lightray_ally_it · ops: if, forEach, macro

### `snipe.divine` — Spear of Heaven
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 35 damage to target enemy, plus 10 for each time an ally of the user is healed meanwhile (max 30 more). The target of this skill is invisible. Channeled.
- inline statuses: spear_of_heaven, spear_of_heaven_watch, gathered_light · ops: apply, damage, removeEffect
  - inline `spear_of_heaven` (Neutral): At the end of the following turn, unless interrupted, deals 35 damage to its target, plus 10 for each time an ally of the bearer was healed meanwhile (max 30 more).
  - inline `spear_of_heaven_watch` (Neutral; triggers: healed): Each time the bearer is healed, the Spear of Heaven deals 10 more damage (max 30 more).
  - inline `gathered_light` (Neutral): Each stack adds 10 to the Spear of Heaven.

### `trap.divine` — Sacred Tithe
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first Helpful skill target enemy uses is diverted: its effects land on the user's ally with the least HP instead. Invisible.
- inline statuses: sacred_tithe · ops: apply, castSkill
  - inline `sacred_tithe` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Helpful skill is diverted to the applier's ally with the least HP.

### `maneuver.divine` — Seclusion
- Maneuver · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. If they're Anointed, it's spent, and they're Exalted until the end of their next turn.
- applies: invulnerable, exalted · ops: apply, if, removeEffect

### `companion.divine` — Seraph
- Companion · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- Summons a Seraph (40 HP) permanently. Burning Light (W): 15 damage to target enemy, and they're Condemned. Whenever a Condemn it applied triggers, the Seraph Sanctifies that enemy for 1 turn.
- summons: seraph · ops: summon

### `bolt.divine` — Revelation
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Marks them for 1 turn. Every Invisible effect in the battle is revealed and ends, on both sides, the user's own included.
- applies: mark · ops: damage, apply, reveal

### `blast.divine` — Glory
- Blast · cost IW · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to all enemies. The user is Exalted for 1 turn, plus 1 more turn for each enemy it leaves below half HP (max 3 turns).
- applies: exalted · ops: damage, set, apply

### `consume.divine` — Ascend
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy; the user heals 10. If the target is Sanctified, it's spent and the user is Exalted for 2 turns; otherwise the target is Sanctified for 2 turns.
- applies: exalted, sanctify · ops: damage, heal, if, removeEffect, apply

### `summon.divine` — Harbinger
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Harbinger (20 HP) for 3 turns. While it lives, the user is Exalted. Trumpet (W): 10 damage to all enemies.
- applies: exalted · summons: harbinger · ops: summon, apply

### `channel.divine` — Unending Light
- Channel · cost A · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 2 turns, at the end of each of the user's turns, a random enemy who isn't Sanctified takes 10 damage and is Sanctified for 1 turn; then every ally heals 5 per Sanctified enemy. Channeled.
- applies: sanctify · inline statuses: unending_light · ops: apply, forEach, damage, heal
  - inline `unending_light` (Neutral; triggers: turnEnd): Sanctifies a random enemy each turn and heals allies per Sanctified enemy.

### `stab.divine` — Even Scales
- Stab · cost A · cooldown 0 · target **any** · tags Radiant, NonStrategic
- Radiant. Enemy: 10 damage, or 20 if they have more HP than the user. Ally: heals 10, or 20 if they have less HP than the user.
- macros: scales_enemy_it, scales_ally_it · ops: if, forEach, macro

### `ravage.divine` — Unfailing Grace
- Ravage · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. Until the end of the user's next turn, their skills don't spend their Anointed.
- inline statuses: unfailing_grace · ops: damage, apply
  - inline `unfailing_grace` (Buff): The bearer's Anointed isn't spent.

### `mislead.divine` — Divine Intervention
- Mislead · cost A · cooldown 2 · target **any** · tags Radiant, Strategic, Invisible
- Radiant, for 1 turn. Enemy: if they use a Harmful skill, it's countered. Ally: the first Harmful skill used on them is countered. Either way, the countered skill's user is Condemned. Invisible.
- macros: intervention_enemy_it, intervention_ally_it · ops: if, forEach, macro

### `stun.divine` — Awe
- Stun · cost A · cooldown 2 · target **any** · tags Radiant, Strategic
- Radiant. Enemy: Stunned for 1 turn, then Condemned when it ends. Ally: loses all Stuns and gains 1 Swiftness for 2 turns.
- macros: awe_enemy_it, awe_ally_it · ops: if, forEach, macro

### `dance.divine` — Transfiguration
- Dance · cost AA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 2 turns, the user is Invulnerable and Immune and their healing is doubled, but they can only use Helpful skills.
- applies: invulnerable, immune · inline statuses: transfiguration · ops: apply, heal
  - inline `transfiguration` (Neutral; triggers: healDone): The bearer's healing is doubled, and they can only use Helpful skills.

### `heal.divine` — Miracle
- Heal · cost free · cooldown 6 · target **ally** · tags Helpful, Strategic
- Target ally heals to full HP and loses all their Debuffs.
- ops: heal, removeKind

### `bless.divine` — Consecrate
- Bless · cost r · cooldown 2 · target **any** · tags Radiant, Strategic
- Radiant. Ally: for 2 turns, each enemy they hit is Condemned. Enemy: for 2 turns, each ally of the user who hits them is Anointed until the end of their next turn.
- macros: consecrate_enemy_it, consecrate_ally_it · ops: if, forEach, macro

### `curse.divine` — Anathema
- Curse · cost A · cooldown 2 · target **any** · tags Radiant, Strategic
- Radiant. Enemy: Condemned, and every Debuff on the user's ally with the least HP moves onto them. Ally: their Debuffs move onto the enemy with the most HP, who is Condemned.
- macros: anathema_enemy_it, anathema_ally_it · ops: if, forEach, macro

### `smite.divine` — Karmic Light
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 2 turns, each unit they hit heals 10 afterward.
- inline statuses: karmic_light · ops: damage, apply, heal
  - inline `karmic_light` (Debuff; triggers: dealtDamage): Each unit the bearer hits heals 10 afterward.

### `prayer.divine` — Benediction
- Prayer · cost WW · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield. Healing past an ally's max HP instead deals that much damage to a random enemy.
- applies: shield · ops: forEach, heal, if, damage, apply

### `cleave.divine` — Twin Radiance
- Cleave · cost S · cooldown 1 · target **any** · tags Radiant, NonStrategic
- Radiant. Hits the target and one random unit on the other side: enemies take 15 damage, allies heal 15.
- ops: if, damage, heal

### `shout.divine` — Truce of God
- Shout · cost W · cooldown 3 · target **none** · tags Harmful, Strategic, Bypass
- For 1 turn, no unit on either side can use Harmful skills. Bypass.
- inline statuses: truce_of_god · ops: apply
  - inline `truce_of_god` (Neutral): Can't use Harmful skills.

### `withstand.divine` — Aegis of Faith
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 2 turns, and is Anointed while any of it remains.
- applies: anointed · inline statuses: aegis_of_faith · ops: apply
  - inline `aegis_of_faith` (Buff): While any of this Shield remains, the bearer is Anointed.

### `taunt.divine` — Beacon
- Taunt · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. Each time they damage the user, the user is Exalted until the end of their next turn.
- applies: taunt, exalted · inline statuses: beacon · ops: apply, if
  - inline `beacon` (Debuff; triggers: dealtDamage): Each time the bearer damages the applier, the applier is Exalted until the end of their next turn.

### `titan.divine` — Avatar
- Titan · cost Wr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Exalted and gains 2 Armor. Whenever they Condemn an enemy, a random ally is Anointed until the end of their next turn.
- applies: exalted, armor, anointed · inline statuses: avatar · ops: apply
  - inline `avatar` (Buff; triggers: effectApplied): Each Condemn the bearer applies Anoints a random ally until the end of their next turn.

### `seraph_burning_light` — Burning Light (minion skill of `seraph`)
- Minion · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Condemns them.
- applies: condemned · ops: damage, apply

### `harbinger_trumpet` — Trumpet (minion skill of `harbinger`)
- Minion · cost W · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `seraph` — Seraph, 40 HP; skills: seraph_burning_light
  - passive `seraph_judgment` (triggers: ownEffectTriggered): Whenever a Condemn it applied triggers, it Sanctifies that enemy for 1 turn.
- `harbinger` — Harbinger, 20 HP; skills: harbinger_trumpet

## Named statuses defined here (1) — this group owns their default animations

- `exalted` — Exalted (Buff): Counts as Anointed. The bearer's Radiant skills reach both sides: used on an ally, they also hit a random enemy; used on an enemy, they also help the ally with the least HP. _Applied by skills in: divine._

## Macros defined here (12) — this group owns their default animations

- `lightray_enemy_it`: ops damage, apply, heal. _Used by: divine._
- `lightray_ally_it`: ops heal, apply; applies condemned. _Used by: divine._
- `scales_enemy_it`: ops damage. _Used by: divine._
- `scales_ally_it`: ops heal. _Used by: divine._
- `intervention_enemy_it`: ops apply; applies condemned. _Used by: divine._
- `intervention_ally_it`: ops apply; applies condemned. _Used by: divine._
- `awe_enemy_it`: ops apply; applies stun, condemned. _Used by: divine._
- `awe_ally_it`: ops removeEffect, apply; applies swiftness. _Used by: divine._
- `consecrate_ally_it`: ops apply; applies condemned. _Used by: divine._
- `consecrate_enemy_it`: ops apply; applies anointed. _Used by: divine._
- `anathema_enemy_it`: ops moveEffects, apply; applies condemned. _Used by: divine._
- `anathema_ally_it`: ops moveEffects, apply; applies condemned. _Used by: divine._
