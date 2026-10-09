# Sun — animation brief

Group id: `sun`. Element(s): Fire + Earth. Concept file: `docs/animations/concepts/sun.yaml`.
Skill source: `packages/content/data/fusions/sun/skills.sun.yaml`; minions: `packages/content/data/fusions/sun/minions.sun.yaml`; statuses: `packages/content/data/fusions/sun/statuses.sun.yaml`; macros: `packages/content/data/fusions/sun/macros.sun.yaml`.

## Skills (32)

### `strike.sun` — Daybreak Blow
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy; the user gains 1 Corona.
- macros: gain_corona · ops: damage, forEach, macro

### `smash.sun` — Scorched Earth
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Halves the Shield of target enemy and their allies, then deals 20 damage to the target and 10 to their allies. Those who had no Shield are Scorched for 1 turn instead.
- applies: scorched · ops: forEach, if, scaleShields, apply, damage

### `charge.sun` — Rolling Sunstone
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and creates a Sunstone, a Boulder (20 HP). At the start of the user's next turn, it deals the target damage equal to its remaining HP. It Explodes when it does, or when it's destroyed.
- inline statuses: rolling_sunstone · summons: sunstone · ops: damage, summon, apply, set, kill
  - inline `rolling_sunstone` (Neutral): At the start of its creator's next turn, it deals its target damage equal to its remaining HP, then Explodes.

### `riposte.sun` — Sunspot
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user takes 15 Affliction damage per Corona the user has, and the user's Corona lasts 2 turns longer. Invisible.
- inline statuses: sunspot · ops: apply, damage, extendEffects
  - inline `sunspot` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user takes 15 Affliction damage per Corona.

### `rage.sun` — Solar Maximum
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune, can hold up to 5 Corona and gains 1 at the start of each of their turns. When it ends, their Corona drops to 3.
- applies: immune · inline statuses: solar_maximum · macros: gain_corona · ops: apply, forEach, macro, repeat, removeStacks
  - inline `solar_maximum` (Buff; triggers: turnStart): Holds up to 5 Corona and gains 1 each turn; drops to 3 when this ends.

### `shot.sun` — Noon Ray
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the user has no Corona, they gain 1; otherwise it Flares: 10 more per Corona.
- macros: solar_flare, gain_corona · ops: if, macro, damage, forEach

### `snipe.sun` — Zenith Spear
- Snipe · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 45 damage to target enemy. Flare: when it lands, every ally heals 10 per Corona spent. The target of this skill is invisible. Channeled.
- inline statuses: zenith_spear · macros: solar_flare · ops: macro, apply, damage, heal
  - inline `zenith_spear` (Neutral): At the end of the following turn, deals 45 damage to its target; every ally heals 10 per Corona spent.

### `trap.sun` — Sunlit Furrow
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, each time target enemy uses a Harmful skill, they take 10 damage and the user creates a Seedling (up to 3). Invisible.
- inline statuses: sunlit_furrow · summons: seedling · ops: apply, damage, if, summon
  - inline `sunlit_furrow` (Debuff, hidden; triggers: skillUsed): Each Harmful skill the bearer uses deals them 10 damage, and the applier creates a Seedling.

### `maneuver.sun` — Horizon
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. At the start of their next turn, they gain 1 Corona, and each enemy who used a Harmful skill meanwhile is Ignited.
- applies: invulnerable, ignite · inline statuses: horizon, horizon_watch · macros: gain_corona · ops: apply, forEach, macro, setFlag, if
  - inline `horizon` (Buff): At the start of the bearer's next turn, they gain 1 Corona.
  - inline `horizon_watch` (Debuff, hidden; triggers: skillUsed): If the bearer uses a Harmful skill before the start of the applier's next turn, they're Ignited then.

### `companion.sun` — Sunflower
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Sunflower (40 HP, counts as a Seedling) permanently; it always has 1 Corona. Scatter Seeds (r): the Sunflower loses 10 HP and creates a Seedling.
- summons: sunflower · ops: summon

### `bolt.sun` — Ripening Vine
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Each allied Seedling uses Channel Earth at no cost, then loses 5 HP. If there's no allied Seedling, the user creates one instead.
- summons: seedling · ops: damage, if, forEach, castSkill, summon

### `blast.sun` — Noonburst
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Flare: 10 more to each per Corona, but the user is Scorched for 1 turn per Corona spent.
- applies: scorched · macros: solar_flare · ops: macro, damage, if, apply

### `consume.sun` — Lingering Light
- Consume · cost W · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it, 10 more if the target is Ignited. The user gains 1 Corona, and all their Corona lasts 2 turns longer.
- macros: gain_corona · ops: damage, heal, forEach, macro, extendEffects

### `summon.sun` — Sunseed
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Sunseed (20 HP) for 3 turns with 1 Corona. When it dies or expires, its creator gains its Corona. Brighten (r): the Sunseed gains 1 Corona.
- summons: sunseed · ops: summon

### `channel.sun` — Long Summer
- Channel · cost Ir · cooldown 3 · target **self** · tags Helpful, Strategic, Channeled
- For 3 turns, at the end of each of the user's turns, they gain 1 Corona. While it channels, their Corona doesn't expire and deals double to Ignited enemies. Channeled.
- inline statuses: long_summer · macros: gain_corona · ops: apply, forEach, macro, extendEffects
  - inline `long_summer` (Neutral; triggers: turnEnd): Each turn, 1 Corona; meanwhile Corona doesn't expire and deals double to Ignited enemies.

### `stab.sun` — Tinder Spike
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Ignites them. The user is Ignited as well.
- applies: ignite · ops: damage, apply

### `ravage.sun` — Upwelling Magma
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy, +10 for each of the user's turns since they last dealt direct damage (max +30).
- ops: set, damage

### `mislead.sun` — Blinding Noon
- Mislead · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they're Blinded for 1 turn per Corona the user has (at least 1). Invisible.
- applies: blinded · inline statuses: blinding_noon · ops: apply
  - inline `blinding_noon` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they're Blinded per Corona.

### `stun.sun` — Sunstroke
- Stun · cost Ar · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn and Ignited. Flare: 1 more turn of Stun per 2 Corona.
- applies: stun, ignite · macros: solar_flare · ops: macro, apply

### `dance.sun` — Basking
- Dance · cost Ar · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness, and each time their Corona ticks they gain 1 Might for 1 turn. They gain 1 Corona now.
- applies: swiftness · inline statuses: basking · macros: gain_corona · ops: apply, forEach, macro
  - inline `basking` (Buff): Each time the bearer's Corona ticks, they gain 1 Might.

### `heal.sun` — Sunlit Mending
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. Each Ignite or Scorch on them is removed and becomes 1 Corona.
- macros: gain_corona · ops: heal, set, removeEffect, repeat, forEach, macro

### `bless.sun` — Heliotrope
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains Heliotrope (works as 1 Might and 1 Renew). At the start of each of the user's turns, it moves to the ally with the least HP.
- inline statuses: heliotrope, heliotrope_turn · ops: apply, heal, moveEffects
  - inline `heliotrope` (Buff; triggers: turnEnd): +5 direct damage, and heals 5 at the end of the applier's turn.
  - inline `heliotrope_turn` (Neutral; triggers: turnStart): At the start of the bearer's turns, the Heliotrope moves to the ally with the least HP.

### `curse.sun` — Drought
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Scorched for 2 turns; the healing the Scorch denies them goes to a random ally of the user instead.
- applies: scorched · inline statuses: drought · ops: apply, if, heal
  - inline `drought` (Debuff; triggers: healed): The healing Scorched denies the bearer goes to a random ally of the applier.

### `smite.sun` — Pillar of Noon
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Flare: for 1 turn per Corona spent, allies who damage them gain 1 Corona.
- inline statuses: pillar_of_noon · macros: solar_flare, gain_corona · ops: macro, damage, if, apply, forEach
  - inline `pillar_of_noon` (Debuff; triggers: damaged): The applier's allies who damage the bearer gain 1 Corona.

### `prayer.sun` — Hymn to the Sun
- Prayer · cost Srr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. Flare: every ally gains 1 Corona per 2 Corona spent, rounded up.
- macros: solar_flare, gain_corona · ops: macro, heal, forEach, repeat

### `cleave.sun` — Stubble Burn
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and 15 to a random other enemy. Then whichever of them has more HP left takes 10 more damage and is Ignited.
- applies: ignite · ops: damage, forEach, set, if, apply

### `shout.sun` — Dawn Chorus
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Every allied minion gains 1 Corona, and it ticks once now.
- applies: intimidated · macros: gain_corona · ops: apply, forEach, macro, set, damage, heal

### `withstand.sun` — Kiln Wall
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 2 turns. Each time it absorbs damage, the user gains 1 Corona.
- inline statuses: kiln_wall · macros: gain_corona · ops: apply, forEach, macro
  - inline `kiln_wall` (Buff; triggers: shieldDamaged): A Shield; each time it absorbs damage, the bearer gains 1 Corona.

### `taunt.sun` — High Noon
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. For as long, no other enemy can target the user.
- applies: taunt, high_noon_shut · inline statuses: high_noon · ops: apply
  - inline `high_noon` (Buff): Only the Taunted enemy can target the bearer.

### `titan.sun` — Red Giant
- Titan · cost WW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune, and at the start of each of their turns, they gain 15 max HP and heal 15. When it ends, they lose that max HP, and every enemy takes as much damage.
- applies: immune · inline statuses: red_giant · ops: apply, setCounter, addMaxHp, heal, damage
  - inline `red_giant` (Buff; triggers: turnStart): Gains 15 max HP each turn; when this ends, loses that max HP, and every enemy takes as much damage.

### `sunflower_scatter_seeds` — Scatter Seeds (minion skill of `sunflower`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- The Sunflower loses 10 HP and creates a Seedling.
- summons: seedling · ops: damage, summon

### `sunseed_brighten` — Brighten (minion skill of `sunseed`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- The Sunseed gains 1 Corona.
- macros: gain_corona · ops: forEach, macro

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `sunstone` — Sunstone, 20 HP; skills: none
- `sunflower` — Sunflower, 40 HP; skills: sunflower_scatter_seeds
- `sunseed` — Sunseed, 20 HP; skills: sunseed_brighten

## Named statuses defined here (3) — this group owns their default animations

- `corona` — Corona (Buff; triggers: turnEnd): Max 3. At the end of the applier's turn, every enemy takes 5 Affliction per stack and every ally heals 5 per stack. _Applied by skills in: none directly._
- `sun_heart` — Sun's Heart (Neutral; triggers: dealtDamage): Tracks the turns since this character last dealt direct damage. _Applied by skills in: none directly._
- `high_noon_shut` — High Noon (Debuff): Can't target or damage the High Noon user. _Applied by skills in: sun._

## Macros defined here (2) — this group owns their default animations

- `gain_corona`: ops apply, if, removeStacks; applies corona. _Used by: sun._
- `solar_flare`: ops set, removeEffect. _Used by: sun._
