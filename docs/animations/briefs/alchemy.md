# Alchemy — animation brief

Group id: `alchemy`. Element(s): Fire + Water. Concept file: `docs/animations/concepts/alchemy.yaml`.
Skill source: `packages/content/data/fusions/alchemy/skills.alchemy.yaml`; minions: `packages/content/data/fusions/alchemy/minions.alchemy.yaml`; statuses: `packages/content/data/fusions/alchemy/statuses.alchemy.yaml`; macros: `packages/content/data/fusions/alchemy/macros.alchemy.yaml`.

## Skills (31)

### `strike.alchemy` — Calcining Blow
- Strike · cost I · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Their Ignite ticks at once, plus once more for each Buff they have (max 3 more).
- ops: damage, if

### `smash.alchemy` — Kiln Crash
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. Each of their allies gains Catalyst.
- applies: catalyst_debuff · ops: damage, apply

### `charge.alchemy` — Steam Rush
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user gets 1 Focus for their next skill. The user gains 1 Renew for each Ignited enemy (max 3).
- applies: focus, renew · ops: damage, apply

### `riposte.alchemy` — Reactive Flask
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user. Its user's Might, Armor, Focus and Renew are Transmuted, and they gain Catalyst. Invisible.
- applies: catalyst_debuff · inline statuses: reactive_flask · ops: apply, transmute
  - inline `reactive_flask` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user's Buffs are Transmuted and they gain Catalyst.

### `rage.alchemy` — Magnum Opus
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might, and gains Catalyst at the start of each of their turns.
- applies: might, catalyst · inline statuses: magnum_opus · ops: apply
  - inline `magnum_opus` (Buff; triggers: turnStart): The bearer gains Catalyst at the start of each of their turns.

### `shot.alchemy` — Vial Toss
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Ignites them. For 2 turns, if that Ignite is removed from them, they Explode.
- applies: ignite · inline statuses: vial_toss · macros: explode · ops: damage, apply, if, removeSelf, macro
  - inline `vial_toss` (Neutral; triggers: turnEnd): If the bearer's Ignite is gone at the end of the applier's turn, they Explode.

### `snipe.alchemy` — Distilled Arrow
- Snipe · cost Ir · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy, plus the total healing they received in the meantime. The target of this skill is invisible. Channeled.
- inline statuses: distilled_arrow, distilled_arrow_mark · ops: setCounter, apply, forEach, damage
  - inline `distilled_arrow` (Neutral): Strikes its target at the end of the following turn for 40 plus the healing they received.
  - inline `distilled_arrow_mark` (Debuff, hidden; triggers: healed): Healing the bearer receives is added to Distilled Arrow's damage.

### `trap.alchemy` — Volatile Compound
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, each time target enemy uses a skill, they gain Catalyst. If they already have it, they lose it and Explode instead. Invisible.
- applies: catalyst_debuff · inline statuses: volatile_compound · macros: explode · ops: apply, if, removeEffect, macro
  - inline `volatile_compound` (Debuff, hidden; triggers: skillUsed): Each skill the bearer uses gives them Catalyst, or makes them Explode if they had it.

### `maneuver.alchemy` — Sublimate
- Maneuver · cost I · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. Their Debuffs are removed, and for each one, a random enemy gains Catalyst.
- applies: invulnerable, catalyst_debuff · ops: apply, repeat, removeKind

### `companion.alchemy` — Homunculus
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Homunculus (30 HP) permanently. At the end of each of your turns, one stack of Might, Armor, Focus or Renew on a random enemy is Transmuted, and a random ally gains 1 Renew.
- summons: homunculus · ops: summon

### `bolt.alchemy` — Quicksilver Bolt
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they have Catalyst, the doubled hit also Transmutes one of their Buffs; if not, they gain Catalyst.
- applies: catalyst_debuff · ops: if, damage, transmute, apply

### `blast.alchemy` — Chain Reaction
- Blast · cost II · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. Each enemy with Catalyst Explodes.
- macros: explode · ops: forEach, setCounter, damage, macro

### `consume.alchemy` — Essence Extraction
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. Then their max HP drops by 10 and the user's rises by 10 for the rest of the match (up to 30 per enemy).
- ops: damage, heal, if, addMaxHp, setCounter

### `summon.alchemy` — Alembic
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Alembic (15 HP) for 3 turns. Brew (nc) gives target unit, ally or enemy, Catalyst.
- summons: alembic · ops: summon

### `channel.alchemy` — Slow Distillation
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, counts the end of each of the user's turns. When it ends, whether it runs its course or is broken early (using another skill breaks it), it deals 10 damage to every enemy and heals every ally 5 for each turn counted. Channeled.
- inline statuses: distillation_release, slow_distillation · ops: setCounter, apply, damage, heal, removeSelf
  - inline `distillation_release` (Neutral; triggers: ownEffectEnded): When Slow Distillation ends, deals 10 damage to every enemy and heals every ally 5 for each turn it counted.
  - inline `slow_distillation` (Neutral; triggers: turnEnd): Counts the end of each of the bearer's turns; when it ends, deals 10 damage to every enemy and heals every ally 5 per turn counted.

### `stab.alchemy` — Probing Lancet
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If they have more Buffs than Debuffs, one of their Buffs is Transmuted (one with no recipe is removed); if not, this deals 10 more damage.
- ops: if, damage, transmute

### `ravage.alchemy` — Boiling Point
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. The user loses all their Renew, and the target's Ignite ticks once per stack lost (max 4).
- ops: damage, if, removeEffect

### `mislead.alchemy` — Inversion Circle
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Helpful skill, it's countered, and its targets take 15 Affliction damage and are Weakened for 1 turn instead. Invisible.
- applies: weakness · inline statuses: inversion_circle · ops: apply, damage
  - inline `inversion_circle` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Helpful skill is countered, and its targets take 15 Affliction damage and are Weakened for 1 turn instead.

### `stun.alchemy` — Flash Powder
- Stun · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Stuns them for 1 turn; Swiftness can't stop it: each Swiftness on them is Transmuted into 1 Confusion instead.
- applies: confusion, stun · ops: damage, if, apply, removeEffect

### `dance.alchemy` — Quickening Draught
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains Catalyst. At the start of their next turn, they gain 1 Might, 2 Swiftness and 1 Focus for 3 turns, doubled if the Catalyst is still unspent.
- applies: catalyst, might, swiftness, focus · inline statuses: quickening_draught · ops: apply, if, removeEffect
  - inline `quickening_draught` (Buff): At the start of the bearer's next turn, they gain Might, Swiftness and Focus (doubled with Catalyst).

### `heal.alchemy` — Panacea
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15; their Debuffs are Transmuted into 2 Renew each.
- applies: renew · ops: heal, apply, removeKind

### `bless.alchemy` — Universal Solvent
- Bless · cost S · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might, and their Normal damage is Piercing.
- applies: might · inline statuses: universal_solvent · ops: apply
  - inline `universal_solvent` (Buff): The bearer's Normal damage is Piercing.

### `curse.alchemy` — Gold into Lead
- Curse · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- All of target enemy's Buffs are Transmuted; any without a recipe are removed.
- ops: transmute

### `smite.alchemy` — Reagent Brand
- Smite · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who gains Catalyst. For 1 turn, each ally skill that damages them gives them Catalyst again.
- applies: catalyst_debuff · inline statuses: reagent_brand · ops: damage, apply
  - inline `reagent_brand` (Debuff; triggers: damaged): Direct damage from the applier's side gives the bearer Catalyst again.

### `prayer.alchemy` — Equivalent Exchange
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15. Every Renew on enemies is Transmuted into Weakness, and each ally gains 1 Renew per 2 stacks converted.
- applies: renew · ops: heal, transmute, apply

### `cleave.alchemy` — Splash Potion
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Weakened for 1 turn. Every other enemy takes 5 damage for each Debuff on the target (up to 15).
- applies: weakness · ops: damage, apply, set

### `shout.alchemy` — Souring Vapors
- Shout · cost I · cooldown 2 · target **allEnemies** · tags Harmful, Strategic
- For 1 turn, every Buff an enemy gains is Transmuted on arrival.
- inline statuses: souring_vapors · ops: apply, transmute
  - inline `souring_vapors` (Debuff; triggers: effectGained): Every Buff the bearer gains is Transmuted on arrival.

### `withstand.alchemy` — Steam Barrier
- Withstand · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. When it ends, what's left of it is Transmuted into Renew, 1 per 5 Shield.
- applies: renew · inline statuses: steam_barrier · ops: apply
  - inline `steam_barrier` (Buff): A Shield; what's left when it ends becomes Renew, 1 per 5.

### `taunt.alchemy` — Lure Flask
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. Meanwhile, the user heals half the damage that enemy deals them.
- applies: taunt · inline statuses: lure_flask · ops: apply, if, heal
  - inline `lure_flask` (Buff; triggers: damaged): The bearer heals half the damage dealt to them by enemies they Taunted.

### `titan.alchemy` — The Great Work
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For the rest of the match, the user has 2 Armor and Immune, but can't gain any other Buff.
- applies: armor, immune · inline statuses: the_great_work · ops: apply
  - inline `the_great_work` (Neutral): The bearer can't gain any other Buff.

### `alembic_brew` — Brew (minion skill of `alembic`)
- Minion · cost free · cooldown 0 · target **any** · tags Radiant, Strategic
- Target unit, ally or enemy, gains Catalyst for 2 turns.
- macros: give_catalyst · ops: forEach, macro

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `homunculus` — Homunculus, 30 HP; skills: none
  - passive `homunculus_work` (triggers: turnEnd): At the end of its owner's turn, one stack of Might, Armor, Focus or Renew on a random enemy is Transmuted, and a random ally gains 1 Renew.
- `alembic` — Alembic, 15 HP; skills: alembic_brew

## Named statuses defined here (2) — this group owns their default animations

- `catalyst` — Catalyst (Buff): The next skill that affects the bearer is doubled for them: twice the damage, healing, and the stacks and duration of what it applies. _Applied by skills in: alchemy._
- `catalyst_debuff` — Catalyst (Debuff): The next skill that affects the bearer is doubled for them: twice the damage, healing, and the stacks and duration of what it applies. _Applied by skills in: alchemy._

## Macros defined here (1) — this group owns their default animations

- `give_catalyst`: ops if, apply; applies catalyst_debuff, catalyst. _Used by: alchemy._
