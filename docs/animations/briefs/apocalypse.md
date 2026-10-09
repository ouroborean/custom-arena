# Apocalypse — animation brief

Group id: `apocalypse`. Element(s): Fire + Ice. Concept file: `docs/animations/concepts/apocalypse.yaml`.
Skill source: `packages/content/data/fusions/apocalypse/skills.apocalypse.yaml`; minions: `packages/content/data/fusions/apocalypse/minions.apocalypse.yaml`; statuses: `packages/content/data/fusions/apocalypse/statuses.apocalypse.yaml`; macros: `packages/content/data/fusions/apocalypse/macros.apocalypse.yaml`.

## Skills (30)

### `strike.apocalypse` — Tempering Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. They're Ignited if they have a Frost debuff, otherwise Frostbitten for 1 turn.
- applies: ignite, frostbitten · ops: damage, if, apply

### `smash.apocalypse` — Worldbreaker
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies, then the target gains Frostfire. If that Thermal Shocks them, each of their allies with a Fire or Frost debuff is Shocked too.
- applies: frostfire · macros: thermal_check · ops: damage, if, apply, forEach, macro

### `charge.apocalypse` — Coldsnap Dash
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who gains Frostfire, and the user gets 1 Focus for their next skill. If that skill hits an enemy who's Chilled and Ignited (Frostfire is both), their Ignite ticks twice at once.
- applies: frostfire, focus · inline statuses: coldsnap · ops: damage, apply, forEach
  - inline `coldsnap` (Buff; triggers: skillUsed): The bearer's next skill makes the Ignite on each Chilled, Ignited enemy it targets tick twice at once.

### `riposte.apocalypse` — Splintering Spines
- Riposte · cost I · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, and every other enemy gains Frostfire. Invisible.
- applies: frostfire · inline statuses: twin_spines · ops: apply
  - inline `twin_spines` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; every other enemy gains Frostfire.

### `rage.apocalypse` — Ragnarok
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 3 Might on their first and third turns, and 3 Armor and Immune on their second and fourth.
- applies: might, armor, immune · inline statuses: ragnarok · ops: setCounter, apply, if
  - inline `ragnarok` (Buff; triggers: turnStart): Alternates 3 Might and 3 Armor with Immune at the start of each of the bearer's turns.

### `shot.apocalypse` — Sleetspark
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If the user hits them with this skill again before the end of the user's next turn, they're Thermal Shocked.
- inline statuses: sleetspark · macros: thermal_check · ops: damage, if, removeEffect, forEach, macro, apply
  - inline `sleetspark` (Debuff): If the applier hits the bearer with Sleetspark again, the bearer is Thermal Shocked.

### `snipe.apocalypse` — Comet of Ruin
- Snipe · cost AIr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 45 damage to target enemy. If they gain a Fire or Frost debuff first, it lands at once and Thermal Shocks them. The target of this skill is invisible. Channeled.
- inline statuses: comet_of_ruin, comet_of_ruin_mark · macros: thermal_check · ops: apply, damage, removeEffect, forEach, macro
  - inline `comet_of_ruin` (Neutral): Strikes its target at the end of the following turn unless interrupted.
  - inline `comet_of_ruin_mark` (Debuff, hidden; triggers: effectGained): If the bearer gains a Fire or Frost debuff, Comet of Ruin hits them at once and Thermal Shocks them.

### `trap.apocalypse` — Cracking Floe
- Trap · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy falls to 50 HP or less, they take 20 Piercing damage and are Stunned for 1 turn. Invisible.
- applies: stun · inline statuses: cracking_floe · ops: apply, if, removeSelf, damage
  - inline `cracking_floe` (Debuff, hidden; triggers: damaged): The first time the bearer falls to 50 HP or less, they take 20 Piercing damage and are Stunned.

### `maneuver.apocalypse` — Steamstep
- Maneuver · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn, and for 1 more turn after that, Invulnerable to enemies with a Fire debuff.
- applies: invulnerable · inline statuses: steamstep · ops: apply
  - inline `steamstep` (Buff): Invulnerable to enemies with a Fire debuff.

### `companion.apocalypse` — Rimeflame Salamander
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Rimeflame Salamander (35 HP) permanently. At the end of each of your turns, it gives a random enemy Frostfire. When it dies, every enemy with Frostfire is Thermal Shocked.
- summons: rimeflame_salamander · ops: summon

### `bolt.apocalypse` — Paradox Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains Frostfire. If they already had it, they're Thermal Shocked, even if they were already Shocked this turn.
- applies: frostfire · macros: thermal_shock · ops: set, damage, apply, if, forEach, macro

### `blast.apocalypse` — Fimbulfire
- Blast · cost SI · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. Each Ignite on them turns into Frostfire, Thermal Shocking its bearer; each enemy with no Fire debuff is Ignited instead.
- applies: frostfire, ignite · macros: thermal_check · ops: damage, forEach, if, removeEffect, apply, macro

### `consume.apocalypse` — Equilibrium
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, healing the user as much. If they have both a Fire and a Frost debuff (Frostfire counts as both), all their Fire and Frost debuffs end, and the user heals 10 for each one that ended.
- ops: damage, heal, if, set, removeEffect

### `summon.apocalypse` — Twilight Jotunn
- Summon · cost Sr · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons a Twilight Jotunn (60 HP) for 3 turns. At the end of each of your turns, it deals 25 damage to a random enemy. While it stands, the user is Stunned; Swiftness can't stop it.
- inline statuses: jotunn_bond · summons: twilight_jotunn · ops: summon, apply
  - inline `jotunn_bond` (Neutral): Stunned while the Twilight Jotunn stands.

### `channel.apocalypse` — Seasons' End
- Channel · cost II · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies. The first Ignites them all; the second Chills them all for 1 turn; the third makes every Ignited enemy Explode. Channeled.
- applies: ignite, chilled · inline statuses: seasons_end · macros: explode · ops: setCounter, apply, damage, if, forEach, macro
  - inline `seasons_end` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies, then Ignite, Chill, and finally Explosions.

### `stab.apocalypse` — Twin Needle
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and Shatters them for the rest of the turn, then deals 10 more.
- applies: shattered · ops: damage, apply

### `ravage.apocalypse` — Twofold Ruin
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Affliction damage to target enemy, +10 for each Fire or Frost debuff they have. Then those debuffs are removed.
- ops: damage, removeEffect

### `mislead.apocalypse` — Shimmering Air
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they gain Frostfire. A Helpful skill Scorches and Numbs them for 1 turn instead. Invisible.
- applies: frostfire, scorched, numb · inline statuses: shimmering_air · ops: apply
  - inline `shimmering_air` (Debuff, hidden; triggers: skillUsed/counter, skillUsed): The bearer's next Harmful skill is countered and Frostfires them; a Helpful one Scorches and Numbs them.

### `stun.apocalypse` — Hoarfire Hold
- Stun · cost SA · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who gains Frostfire and is Stunned for 1 turn. If the Frostfire is still on them when the Stun ends, it's consumed to Stun them 1 more turn.
- applies: frostfire, stun · inline statuses: hoarfire_hold · ops: damage, apply, if, removeEffect
  - inline `hoarfire_hold` (Debuff): When the Stun ends, a remaining Frostfire is consumed to Stun the bearer 1 more turn.

### `dance.apocalypse` — White Flame Waltz
- Dance · cost SA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus, and Explodes at the end of each of their turns in which they dealt damage.
- applies: swiftness, focus · inline statuses: white_flame_waltz · macros: explode · ops: apply, setFlag, if, macro
  - inline `white_flame_waltz` (Buff; triggers: dealtDamage, turnEnd): The bearer Explodes at the end of each of their turns in which they dealt damage.

### `heal.apocalypse` — Frozen Remedy
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 35 at the end of the enemy's next turn. If a hit would kill them before then, the heal lands first, at once.
- inline statuses: frozen_remedy · ops: apply, if, removeSelf, heal
  - inline `frozen_remedy` (Buff; triggers: damaged): Heals 35 when this ends; a hit that would kill the bearer first triggers it at once.

### `bless.apocalypse` — Tempered
- Bless · cost S · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might, and their direct damage deals 10 more to Shattered enemies.
- applies: might · inline statuses: tempered · ops: apply
  - inline `tempered` (Buff): The bearer's direct damage deals 10 more to Shattered enemies.

### `curse.apocalypse` — Heat Death
- Curse · cost IW · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy gains Frostfire, then 1 Confusion for 2 turns per Fire or Frost debuff they have, Frostfire included (max 3).
- applies: frostfire, confusion · ops: apply

### `smite.apocalypse` — Rimebrand
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who's Sanctified for 1 turn. For 2 turns, each time they use a Harmful skill, they're Frostbitten for 1 turn.
- applies: sanctify, frostbitten · inline statuses: rimebrand · ops: damage, apply
  - inline `rimebrand` (Debuff; triggers: skillUsed): Each Harmful skill the bearer uses Frostbites them for 1 turn.

### `prayer.apocalypse` — Fimbul Vigil
- Prayer · cost SI · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield. For 2 turns, Chilled enemies' skills also cost 1 more random energy.
- applies: shield · inline statuses: fimbul_vigil · ops: heal, apply
  - inline `fimbul_vigil` (Debuff): While Chilled, the bearer's skills cost 1 more random energy.

### `cleave.apocalypse` — Split Horizon
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy, who also gains copies of the target's Fire and Frost debuffs.
- applies: ignite, frostfire, scorched, frostbitten, chilled, numb · ops: damage, forEach, if, apply

### `shout.apocalypse` — Long Night's Toll
- Shout · cost r · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns, and a random one gains Frostfire. For as long, while an enemy has Frostfire, their cooldowns increase by 1 more.
- applies: intimidated, frostfire · inline statuses: long_nights_toll · ops: apply
  - inline `long_nights_toll` (Debuff): While the bearer has Frostfire, their cooldowns increase by 1 more.

### `withstand.apocalypse` — Heart of the Glacier
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 30 Shield until the end of their next turn. When it ends, a random enemy takes damage equal to what's left of it and gains Frostfire.
- applies: frostfire · inline statuses: heart_of_the_glacier · ops: apply, forEach, damage
  - inline `heart_of_the_glacier` (Buff): A Shield; when it ends, a random enemy takes damage equal to what's left and gains Frostfire.

### `taunt.apocalypse` — Circle of Extremes
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns, and every Fire and Frost debuff on their allies moves onto them.
- applies: taunt · ops: apply, moveEffects

### `titan.apocalypse` — Twilight Colossus
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immune, and the first enemy they deal direct damage to on each of their turns is Thermal Shocked, but they're Shattered meanwhile.
- applies: shattered, immune · inline statuses: twilight_colossus · macros: thermal_check · ops: apply, if, setCounter, forEach, macro
  - inline `twilight_colossus` (Buff; triggers: dealtDamage): The first enemy the bearer deals direct damage to on each of their turns is Thermal Shocked.

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `rimeflame_salamander` — Rimeflame Salamander, 35 HP; skills: none
  - passive `rimeflame_breath` (triggers: turnEnd): At the end of its owner's turn, gives a random enemy Frostfire.
- `twilight_jotunn` — Twilight Jotunn, 60 HP; skills: none
  - passive `jotunn_stride` (triggers: turnEnd): At the end of its owner's turn, deals 25 damage to a random enemy.

## Named statuses defined here (3) — this group owns their default animations

- `frostfire` — Frostfire (Debuff; triggers: turnEnd): Counts as both an Ignite and Chilled. Takes 5 Affliction damage at the end of the applier's turn, and can't have skill costs reduced. _Applied by skills in: apocalypse._
- `thermal_shocked` — Thermal Shocked (Neutral): Already Thermal Shocked this turn. _Applied by skills in: none directly._
- `thermal_shock` — Thermal Shock (Neutral; triggers: effectApplied, effectApplied, effectApplied): When this character gives an enemy with a Fire debuff a Frost debuff, or the reverse, that enemy takes 15 Piercing damage and is Shattered for 1 turn (once per unit per turn). _Applied by skills in: none directly._

## Macros defined here (3) — this group owns their default animations

- `thermal_shock`: ops damage, apply; applies shattered, thermal_shocked. _Used by: apocalypse._
- `thermal_check`: ops if, macro. _Used by: apocalypse._
- `frostfire_shock_check`: ops if, macro. _Used by: none directly._
