# Ritual — animation brief

Group id: `ritual`. Element(s): Fire + Shadow. Concept file: `docs/animations/concepts/ritual.yaml`.
Skill source: `packages/content/data/fusions/ritual/skills.ritual.yaml`; minions: `packages/content/data/fusions/ritual/minions.ritual.yaml`; statuses: `packages/content/data/fusions/ritual/statuses.ritual.yaml`; macros: `packages/content/data/fusions/ritual/macros.ritual.yaml`.

## Skills (32)

### `strike.ritual` — Sacrificial Blade
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. Rite (2): the target Explodes.
- inline statuses: rite_sacrificial_blade · macros: clear_rite, rite_step, rite_finish, explode · ops: damage, macro, apply, if, removeSelf
  - inline `rite_sacrificial_blade` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, the target Explodes.

### `smash.ritual` — Circle of Ash
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to the others. Rite (3): every enemy is Ignited and Blinded for 2 turns.
- applies: ignite, blinded · inline statuses: rite_circle_of_ash · macros: clear_rite, rite_step, rite_finish · ops: damage, macro, apply, if, removeSelf
  - inline `rite_circle_of_ash` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, every enemy is Ignited and Blinded for 2 turns.

### `charge.ritual` — Candlestep
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. Rite (1): they take 15 damage and are Ignited.
- applies: ignite · inline statuses: rite_candlestep · macros: clear_rite, rite_step, rite_finish · ops: damage, macro, apply, if, removeSelf
  - inline `rite_candlestep` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, the target takes 15 damage and is Ignited.

### `riposte.ritual` — Warding Candle
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, and their Rite can't be broken until the end of their next turn. Invisible.
- inline statuses: warding_candle_counter, warding_candle · ops: apply
  - inline `warding_candle_counter` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer.
  - inline `warding_candle` (Buff): The bearer's Rite can't be broken.

### `rage.ritual` — Bonfire Revel
- Rage · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune, and every unit on both sides gains 2 Might.
- applies: immune, might · ops: apply

### `shot.ritual` — Severing Spark
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy. If they have no Buffs, they're Isolated for 1 turn.
- applies: isolated · ops: damage, if, apply

### `snipe.ritual` — Far Invocation
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, HiddenTarget
- Rite (2): 50 damage to target enemy, Bypassing Invulnerable, and they're Ignited. The target of this skill is invisible.
- applies: ignite · inline statuses: rite_far_invocation · macros: clear_rite, rite_step, rite_finish · ops: macro, apply, if, removeSelf, damage
  - inline `rite_far_invocation` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, 50 damage to the target, Bypassing, and they're Ignited.

### `trap.ritual` — Chains of Smoke
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, each Harmful skill target enemy uses deals them 10 Affliction damage and advances the user's Rite by 1. Invisible.
- inline statuses: chains_of_smoke · ops: apply, damage, signal
  - inline `chains_of_smoke` (Debuff, hidden; triggers: skillUsed): Each Harmful skill the bearer uses deals them 10 Affliction damage and advances the applier's Rite by 1.

### `maneuver.ritual` — Hush of Smoke
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Stealthy
- For 2 turns, the first time an enemy hits the user, the user becomes Invulnerable for 1 turn, and that enemy is Ignited. Stealthy.
- applies: invulnerable, ignite · inline statuses: hush_of_smoke · ops: apply
  - inline `hush_of_smoke` (Buff; triggers: damaged): The first enemy hit on the bearer makes them Invulnerable for 1 turn and Ignites the attacker.

### `companion.ritual` — Shadow Acolyte
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Shadow Acolyte (30 HP) permanently; each skill it uses advances its summoner's Rite. Chant (r): target ally heals 10. Flame Lash (r): 10 damage and Ignite.
- summons: shadow_acolyte · ops: summon

### `bolt.ritual` — Shadowflame Bolt
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy. The user is Blinded until the end of their next turn.
- applies: blinded · ops: damage, apply

### `blast.ritual` — Rite of Ruin
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. Rite (3): every enemy takes 10 Affliction damage for each skill they used while it counted.
- inline statuses: rite_of_ruin_count, rite_of_ruin · macros: clear_rite, rite_step, rite_finish · ops: damage, setCounter, apply, macro, if, removeSelf, forEach, removeEffect
  - inline `rite_of_ruin_count` (Debuff; triggers: skillUsed): Counts the bearer's skills for Rite of Ruin.
  - inline `rite_of_ruin` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, every enemy takes 10 Affliction per skill they used meanwhile.

### `consume.ritual` — Candle Offering
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 2 turns, at the end of each of the user's turns, target enemy takes 5 Affliction damage and the user heals 10.
- inline statuses: candle_offering · ops: apply, damage, heal
  - inline `candle_offering` (Debuff; triggers: turnEnd): At the end of each of the applier's turns, the bearer takes 5 Affliction damage and the applier heals 10.

### `summon.ritual` — Tended Wick
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Wick (15 HP) for 3 turns. At the end of each of your turns, it deals 10 damage to a random enemy, doubling each time; any damage to it resets it to 10.
- summons: tended_wick · ops: summon

### `channel.ritual` — Dark Liturgy
- Channel · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies and advances the user's Rite by 1. While it lasts, the user can't be Stunned or put to Sleep. Channeled.
- inline statuses: dark_liturgy · ops: apply, damage, signal
  - inline `dark_liturgy` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies and the Rite advances; the bearer can't be Stunned or put to Sleep.

### `stab.ritual` — Ritual Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 25 if it's the skill that completes the user's Rite.
- ops: damage

### `ravage.ritual` — Flashpoint
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy and Ignites them. Then every Ignite on the enemy team burns once now.
- applies: ignite · macros: ignite_tick · ops: damage, apply, forEach, macro

### `mislead.ritual` — Circle of Warding
- Mislead · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and the user's Rite completes at once. Invisible.
- inline statuses: circle_of_warding · ops: apply, signal
  - inline `circle_of_warding` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and the applier's Rite completes.

### `stun.ritual` — Waking Hex
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. After this, the next time they take damage within 2 turns, they're Stunned for 1 turn.
- applies: stun · inline statuses: waking_hex · ops: damage, apply
  - inline `waking_hex` (Debuff; triggers: damaged): The next time the bearer takes damage, they're Stunned for 1 turn.

### `dance.ritual` — Dance of Candles
- Dance · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus, and each skill they use advances their Rite by 1 more.
- applies: swiftness, focus · inline statuses: dance_of_candles · ops: apply
  - inline `dance_of_candles` (Buff): Each skill the bearer uses advances their Rite by 1 more.

### `heal.ritual` — Rite of Mending
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15. Rite (2): all allies heal 25.
- inline statuses: rite_of_mending · macros: clear_rite, rite_step, rite_finish · ops: heal, macro, apply, if, removeSelf
  - inline `rite_of_mending` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, all allies heal 25.

### `bless.ritual` — Double Wick
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 2 turns, target ally Ignites each enemy they damage, and Ignites they apply can stack, up to 2.
- applies: ignite · inline statuses: double_wick · ops: apply, if
  - inline `double_wick` (Buff; triggers: dealtDamage): Enemies the bearer damages are Ignited, and Ignites the bearer applies can stack, up to 2.

### `curse.ritual` — Cursed Flame
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, each skill target enemy uses Ignites a random ally of theirs. Invisible.
- applies: ignite · inline statuses: cursed_flame · ops: apply
  - inline `cursed_flame` (Debuff, hidden; triggers: skillUsed): Each skill the bearer uses Ignites a random ally of theirs (the applier's Ignite).

### `smite.ritual` — Offering Brand
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and brands them. Rite (2): the user's ally with the least HP heals half of all the direct damage the target took while it counted.
- inline statuses: rite_offering_brand, offering_brand · macros: clear_rite, rite_step, rite_finish · ops: damage, macro, setCounter, apply, if, removeSelf, heal
  - inline `rite_offering_brand` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, the user's ally with the least HP heals half the direct damage the branded enemy took meanwhile.
  - inline `offering_brand` (Debuff; triggers: damaged): Direct damage the bearer takes is counted for the applier's Rite.

### `prayer.ritual` — Vigil of Candles
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. Rite (3): every ally who hasn't taken damage since it started heals 30 and gains Stealth for 2 turns.
- applies: stealth · inline statuses: vigil_watch, rite_vigil · macros: clear_rite, rite_step, rite_finish · ops: heal, apply, removeSelf, macro, if, forEach, removeEffect
  - inline `vigil_watch` (Buff; triggers: damaged): Hasn't taken damage since Vigil of Candles was used.
  - inline `rite_vigil` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, every ally who hasn't taken damage since it started heals 30 and gains Stealth.

### `cleave.ritual` — Cinder Tether
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy. Until the user's next turn, healing either of them receives is dealt to the other as damage instead.
- inline statuses: cinder_tether · ops: damage, forEach, apply
  - inline `cinder_tether` (Debuff; triggers: healed): Healing the bearer receives is dealt to the tethered enemy as damage instead.

### `shout.ritual` — Rings of Ash
- Shout · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Isolated for 2 turns. Rite (1): every enemy who's still Isolated takes 10 Affliction damage.
- applies: isolated · inline statuses: rite_rings_of_ash · macros: clear_rite, rite_step, rite_finish · ops: apply, macro, if, removeSelf, forEach, damage
  - inline `rite_rings_of_ash` (Neutral; triggers: skillUsed, signal, signal, effectGained): When it completes, every enemy who's still Isolated takes 10 Affliction damage.

### `withstand.ritual` — Smokewall
- Withstand · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn. If any of it is left when it ends, a random enemy takes damage equal to what's left.
- inline statuses: smokewall · ops: apply, damage
  - inline `smokewall` (Buff): A Shield; whatever is left of it when it runs out is dealt to a random enemy as damage.

### `taunt.ritual` — Effigy
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- The user loses 15 HP and summons an Effigy (30 HP), and target enemy is Taunted by it for 2 turns. If it still stands when the Taunt ends, it dies and the user heals for half the HP it had left. The user needs more than 15 HP to use it.
- applies: taunt · inline statuses: effigy_offering · summons: effigy · ops: damage, summon, apply, heal, kill
  - inline `effigy_offering` (Neutral): When the Taunt ends, the Effigy dies and the user heals for half the HP it had left.

### `titan.ritual` — Candle Colossus
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune, and their HP can't drop below 1. When it ends, every enemy takes 5 Affliction damage for every 20 damage the user took meanwhile (at most 30).
- applies: immune · inline statuses: candle_colossus · ops: apply, setCounter, damage
  - inline `candle_colossus` (Buff; triggers: damaged): HP can't drop below 1; when it ends, every enemy takes 5 Affliction per 20 damage taken meanwhile (max 30).

### `acolyte_chant` — Chant (minion skill of `shadow_acolyte`)
- Minion · cost r · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally heals 10. Advances its summoner's Rite.
- ops: heal, signal

### `acolyte_flame_lash` — Flame Lash (minion skill of `shadow_acolyte`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Ignites them. Advances its summoner's Rite.
- applies: ignite · ops: damage, apply, signal

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `shadow_acolyte` — Shadow Acolyte, 30 HP; skills: acolyte_chant, acolyte_flame_lash
- `tended_wick` — Wick, 15 HP; skills: none
  - passive `tended_wick_flame` (triggers: turnEnd, damaged): At the end of its owner's turn, deals damage to a random enemy (10, doubling each time); any damage to it resets it to 10.
- `effigy` — Effigy, 30 HP; skills: none

## Named statuses defined here (1) — this group owns their default animations

- `rite` — Rite (Neutral): Completes once the user (or their Acolytes) have used as many more skills as it has stacks. Breaks if the user is Stunned, falls Asleep or is Banished. _Applied by skills in: none directly._

## Macros defined here (3) — this group owns their default animations

- `clear_rite`: ops removeEffect, setCounter. _Used by: ritual._
- `rite_step`: ops setCounter, if, macro, addStacksSelf. _Used by: ritual._
- `rite_finish`: ops setCounter, expire. _Used by: ritual._
