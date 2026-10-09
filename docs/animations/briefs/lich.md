# Lich — animation brief

Group id: `lich`. Element(s): Ice + Unholy. Concept file: `docs/animations/concepts/lich.yaml`.
Skill source: `packages/content/data/fusions/lich/skills.lich.yaml`; minions: `packages/content/data/fusions/lich/minions.lich.yaml`; statuses: `packages/content/data/fusions/lich/statuses.lich.yaml`; macros: `packages/content/data/fusions/lich/macros.lich.yaml`.

## Skills (32)

### `strike.lich` — Deathchill Blade
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. The enemy with the lowest HP is Soulfrosted for 2 turns.
- applies: soulfrost · ops: damage, apply

### `smash.lich` — Winter of Souls
- Smash · cost SS · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 damage to target enemy, who is Soulfrosted for 2 turns. Each time it yields a Soul Fragment, their allies take 10.
- applies: soul_fragment · inline statuses: winter_of_souls · ops: damage, apply, if, setCounter
  - inline `winter_of_souls` (Debuff; triggers: damaged): Direct damage gives the applier a Soul Fragment (once per turn), and the bearer's allies take 10.

### `charge.lich` — Chill Stride
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user Soulfrosts themselves for 2 turns, so enemy hits on them give them Soul Fragments.
- applies: soulfrost · ops: damage, apply

### `riposte.lich` — Hidden Vessel
- Riposte · cost I · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user or an allied minion, such as their Phylactery; its user is Soulfrosted for 2 turns. Invisible.
- applies: soulfrost · inline statuses: hidden_vessel · ops: apply
  - inline `hidden_vessel` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer and Soulfrosts their users.

### `rage.lich` — Frozen Undeath
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Immortal and gains 1 Might for every 25 HP they're missing.
- applies: immortal · inline statuses: frozen_undeath · ops: apply
  - inline `frozen_undeath` (Buff): 1 Might (+5 direct damage) per 25 HP the bearer is missing.

### `shot.lich` — Soul Icicle
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the user has a Soul Fragment, they spend it for 10 more, and the target is Soulfrosted for 2 turns.
- applies: soulfrost · ops: if, removeStacks, damage, apply

### `snipe.lich` — Death's Icicle
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 Piercing damage to target enemy. If it kills them, the user creates a Phylactery, or restores theirs to full. The target of this skill is invisible. Channeled.
- inline statuses: deaths_icicle · macros: make_phylactery · ops: apply, forEach, set, damage, if, macro
  - inline `deaths_icicle` (Neutral): At the end of the following turn, deals 40 Piercing damage to its target. If it kills them, the bearer creates a Phylactery, or restores theirs to full.

### `trap.lich` — Frozen Shackle
- Trap · cost II · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a Harmful skill, they're Soulfrosted for 2 turns; the second time, they're also Stunned for 1 turn. Invisible.
- applies: stun, soulfrost · inline statuses: frozen_shackle · ops: apply, if, removeSelf, setFlag
  - inline `frozen_shackle` (Debuff, hidden; triggers: skillUsed): The bearer's first Harmful skill Soulfrosts them; the second Stuns them too.

### `maneuver.lich` — Retreat to the Vessel
- Maneuver · cost I · cooldown 2 · target **self** · tags Helpful, Strategic
- If the user has no Phylactery, they create one. They become Invulnerable until it takes damage, for up to 2 turns.
- inline statuses: vessel_retreat · summons: phylactery · ops: if, summon, apply
  - inline `vessel_retreat` (Buff): Invulnerable until the Phylactery takes damage.

### `companion.lich` — Frost Wight
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Frost Wight (30 HP) permanently. When a hit would kill it, the user spends a Soul Fragment instead and it's left at 1 HP. Rime Claw (S): 15 damage and Soulfrost for 2 turns.
- summons: frost_wight · ops: summon

### `bolt.lich` — Deathfrost Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. They lose all Swiftness and Focus, and are Horrified for 1 turn per stack lost (max 3).
- applies: horrified · ops: damage, set, removeEffect, if, apply

### `blast.lich` — Soul Blizzard
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Those it leaves below 50 HP are Soulfrosted for 2 turns.
- applies: soulfrost · ops: damage, apply

### `consume.lich` — Soul Siphon
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, draining a Soul Fragment. If they're Soulfrosted, it ends, and the user drains 1 more.
- applies: soul_fragment · ops: damage, removeStacks, apply, if, removeEffect

### `summon.lich` — Skeletal Mage
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Skeletal Mage (25 HP) for 3 turns. While it's alive, Frost debuffs on enemies don't count down. Bone Chill (r): 10 damage to target enemy.
- summons: skeletal_mage · ops: summon

### `channel.lich` — Drain Warmth
- Channel · cost rr · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, deals 10 damage to target enemy, and the user's Phylactery's max HP rises by 10 and it heals 10. With no Phylactery, one is created at 10 HP. Channeled.
- inline statuses: drain_warmth · macros: feed_phylactery · ops: apply, damage, if, addMaxHp, heal, set, macro
  - inline `drain_warmth` (Neutral; triggers: turnEnd): At the end of each of the bearer's turns, deals 10 damage to the target, and the bearer's Phylactery's max HP rises by 10 and it heals 10 (or one is created at 10 HP).

### `stab.lich` — Deathly Pallor
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. For 2 turns, they can't be healed above 60 HP.
- inline statuses: deathly_pallor · ops: damage, apply, if
  - inline `deathly_pallor` (Debuff; triggers: healed): Healing can't take the bearer above 60 HP.

### `ravage.lich` — Doomfrost
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, +10 for each Frost debuff on them. Those debuffs end, and they're Horrified for 1 turn per debuff ended.
- applies: horrified · ops: set, damage, removeEffect, if, apply

### `mislead.lich` — Nightmare of Ice
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they're Horrified for 2 turns. Meanwhile, the user is Invulnerable to Horrified enemies. Invisible.
- applies: horrified · inline statuses: nightmare_of_ice, nightmare_ward · ops: apply
  - inline `nightmare_of_ice` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they're Horrified for 2 turns.
  - inline `nightmare_ward` (Buff): Invulnerable to Horrified enemies.

### `stun.lich` — Heart of Ice
- Stun · cost SA · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Soulfrosted for 2 turns. The first time it yields a Soul Fragment, they're Stunned for 1 turn.
- applies: soul_fragment, stun · inline statuses: heart_of_ice · ops: damage, apply, if, setCounter, setFlag
  - inline `heart_of_ice` (Debuff; triggers: damaged): Direct damage gives the applier a Soul Fragment (once per turn); the first time, the bearer is Stunned.

### `dance.lich` — Deathwaltz
- Dance · cost AI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus. Each time any unit or minion dies meanwhile, all the user's cooldowns reset.
- applies: swiftness, focus · inline statuses: deathwaltz · ops: apply, adjustCooldowns
  - inline `deathwaltz` (Buff; triggers: signal): Each death resets all the bearer's cooldowns.

### `heal.lich` — Feed the Vessel
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. A minion, such as a Phylactery, heals 40 instead and gains 1 Armor for 2 turns.
- applies: armor · ops: if, heal, apply

### `bless.lich` — Embalm
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might, and their other Buffs don't count down.
- applies: might · inline statuses: embalm · ops: apply, extendEffects
  - inline `embalm` (Buff; triggers: turnEnd): The bearer's other Buffs don't count down.

### `curse.lich` — Touch of the Grave
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 2 turns, target enemy can't gain Buffs, and each Helpful skill used on them gives the user a Soul Fragment instead (max 3).
- applies: soul_fragment · inline statuses: touch_of_the_grave · ops: setCounter, apply, if
  - inline `touch_of_the_grave` (Debuff; triggers: skillTargeted): Can't gain Buffs; Helpful skills used on the bearer give the applier Soul Fragments.

### `smite.lich` — Vessel's Due
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Sanctified for 1 turn. Each time the Sanctify heals an ally, the user's Phylactery heals 15 too, or is created at 15 HP.
- applies: sanctify · inline statuses: vessels_due · macros: feed_phylactery · ops: damage, apply, if, set, macro
  - inline `vessels_due` (Debuff; triggers: damaged): Each time the bearer's Sanctify heals an ally of the applier, their Phylactery heals 15.

### `prayer.lich` — Frostborn Litany
- Prayer · cost Irr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain Frostborn for 1 turn. While it lasts, they're also Invulnerable to Chilled and Numb enemies, not just Frostbitten ones.
- applies: frostborn · inline statuses: frostborn_litany · ops: heal, apply
  - inline `frostborn_litany` (Buff): Invulnerable to Chilled and Numb enemies.

### `cleave.lich` — Spreading Rime
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to a random other enemy, who also gains a copy of each Frost debuff on the target (for 1 turn).
- applies: frostbitten, chilled, numb, soulfrost, snowbound · ops: damage, forEach, if, apply

### `shout.lich` — Echo from the Tomb
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. 3 turns later, all enemies are Intimidated for 2 turns again.
- applies: intimidated · inline statuses: echo_from_the_tomb · ops: apply
  - inline `echo_from_the_tomb` (Neutral): When this ends, every enemy is Intimidated for 2 turns again.

### `withstand.lich` — Hoarded Life
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. When it ends, the damage it absorbed heals their Phylactery, or creates one with that much HP (at least 10).
- inline statuses: hoarded_life, hoarded_life_store · macros: feed_phylactery · ops: setCounter, apply, set, macro
  - inline `hoarded_life` (Buff; triggers: shieldDamaged): A Shield; what it absorbs is stored for the Phylactery.
  - inline `hoarded_life_store` (Neutral; triggers: ownEffectEnded): When the Hoarded Life Shield ends, what it absorbed goes to the Phylactery.

### `taunt.lich` — Guarded Urn
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted for 2 turns by the user's Phylactery instead of the user; one is created at 20 HP if they have none. The Taunted enemy's damage to it is halved.
- applies: taunt · inline statuses: guarded_urn · macros: feed_phylactery · ops: if, set, macro, apply
  - inline `guarded_urn` (Debuff): The bearer's damage to a Phylactery is halved.

### `titan.lich` — Archlich
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- Creates a Phylactery, or restores the user's to full. For 3 turns, the user gains 2 Armor and Frostborn, and every enemy who damages the Phylactery is Soulfrosted for 2 turns.
- applies: armor, frostborn · inline statuses: archlich · macros: make_phylactery · ops: macro, apply
  - inline `archlich` (Buff): Every enemy who damages the bearer's Phylactery is Soulfrosted for 2 turns.

### `frost_wight_rime_claw` — Rime Claw (minion skill of `frost_wight`)
- Minion · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Soulfrosted for 2 turns.
- applies: soulfrost · ops: damage, apply

### `skeletal_mage_bone_chill` — Bone Chill (minion skill of `skeletal_mage`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `phylactery` — Phylactery, 30 HP; skills: none
  - passive `phylactery_jar` (triggers: damaged): 2 Armor. Damage to it ends its creator's Retreat to the Vessel; during Archlich, its attackers are Soulfrosted.
- `frost_wight` — Frost Wight, 30 HP; skills: frost_wight_rime_claw
  - passive `frost_wight_soul` (triggers: damaged): When a hit would kill it, its creator spends a Soul Fragment instead and it's left at 1 HP.
- `skeletal_mage` — Skeletal Mage, 25 HP; skills: skeletal_mage_bone_chill
  - passive `skeletal_mage_chill` (triggers: turnEnd): While it's alive, Frost debuffs on enemies don't count down.

## Named statuses defined here (2) — this group owns their default animations

- `soulfrost` — Soulfrost (Debuff; triggers: damaged): When the bearer takes direct damage, whoever applied this gains a Soul Fragment (once per turn). _Applied by skills in: lich._
- `phylactery_bond` — Phylactery (Neutral): While the bearer's Phylactery is alive, their HP can't drop below 1. _Applied by skills in: none directly._

## Macros defined here (2) — this group owns their default animations

- `make_phylactery`: ops if, heal, summon. _Used by: lich._
- `feed_phylactery`: ops if, heal, summon, addMaxHp. _Used by: lich._
