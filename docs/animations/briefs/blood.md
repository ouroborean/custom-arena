# Blood — animation brief

Group id: `blood`. Element(s): Water + Unholy. Concept file: `docs/animations/concepts/blood.yaml`.
Skill source: `packages/content/data/fusions/blood/skills.blood.yaml`; minions: `packages/content/data/fusions/blood/minions.blood.yaml`; statuses: `packages/content/data/fusions/blood/statuses.blood.yaml`.

## Skills (32)

### `strike.blood` — Wringing Cut
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. The user removes up to 2 Weakness from them and gains a Soul Fragment for each one removed.
- applies: soul_fragment · ops: damage, set, removeStacks, apply

### `smash.blood` — Crimson Wave
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies. The target gains 1 Hemorrhage, then each of their allies gains half the target's Hemorrhage, rounded up.
- applies: hemorrhage · ops: damage, apply

### `charge.blood` — Quickened Pulse
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains 1 Hemorrhage. When the user's next skill resolves, every enemy's Hemorrhage ticks once more, dealing its damage and gaining a stack.
- applies: hemorrhage · inline statuses: quickened_pulse · ops: damage, apply, setCounter, if, forEach, removeSelf
  - inline `quickened_pulse` (Buff; triggers: skillResolved): When the bearer's next skill resolves, every enemy's Hemorrhage ticks once more.

### `riposte.blood` — Blood Spite
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible, BloodPrice
- For 1 turn, counters the first Harmful skill used on the user; its user gains 1 Hemorrhage for every 20 HP the user is missing. Blood Price. Invisible.
- applies: hemorrhage · inline statuses: blood_spite · ops: apply
  - inline `blood_spite` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user gains 1 Hemorrhage for every 20 HP the bearer is missing.

### `rage.blood` — Crimson Frenzy
- Rage · cost Ir · cooldown 4 · target **self** · tags Helpful, Strategic, BloodPrice
- For 3 turns, the user gains Lifesteal and 1 Might for every 20 HP they're missing, rechecked as each hit lands. Blood Price.
- applies: lifesteal · inline statuses: crimson_frenzy · ops: apply
  - inline `crimson_frenzy` (Buff): +5 direct damage per 20 HP the bearer is missing.

### `shot.blood` — Blood Dart
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic, BloodPrice
- Deals 15 damage to target enemy, who gains 1 Hemorrhage. If they already had Hemorrhage, the user heals back the HP they paid. Blood Price.
- applies: hemorrhage · ops: if, heal, damage, apply

### `snipe.blood` — Crimson Lance
- Snipe · cost Ir · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget, BloodPrice
- On the following turn, deals 40 damage to target enemy, plus the damage the user took in between (max 30 more). The target of this skill is invisible. Blood Price. Channeled.
- inline statuses: crimson_lance · ops: setCounter, apply, damage
  - inline `crimson_lance` (Neutral; triggers: damaged): Strikes its target at the end of the following turn, adding the damage the bearer took.

### `trap.blood` — Tainted Cure
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the next healing target enemy receives becomes Hemorrhage instead: 1 stack per 10 HP it would have healed (max 5). Invisible.
- applies: hemorrhage · inline statuses: tainted_cure · ops: apply, damage
  - inline `tainted_cure` (Debuff, hidden; triggers: healed): The next healing the bearer receives turns into Hemorrhage.

### `maneuver.blood` — Pale Step
- Maneuver · cost I · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- The enemy who last damaged the user (or a random enemy, if none has) gains 1 Hemorrhage. For 1 turn, the user is Invulnerable to enemies with Hemorrhage (they can't target or damage them), and each enemy who damages the user gains 1 Hemorrhage. Invisible.
- applies: hemorrhage · inline statuses: pale_step · ops: if, apply
  - inline `pale_step` (Buff; triggers: damaged): Invulnerable to enemies with Hemorrhage; each enemy who damages the bearer gains 1 Hemorrhage.

### `companion.blood` — Bloodbound Familiar
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Bloodbound Familiar permanently. It has no HP of its own and shares the user's: damage and healing to it go to the user, and it dies only with them. Bite (r): 15 damage.
- summons: bloodbound_familiar · ops: summon

### `bolt.blood` — Sanguine Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, BloodPrice
- Deals 25 damage to target enemy, and the HP the user paid heals their lowest-HP ally, doubled. Blood Price.
- ops: damage, heal

### `blast.blood` — Red Rain
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, BloodPrice
- Deals 25 damage to all enemies. The user spends all their Soul Fragments: each one gives every enemy 1 Hemorrhage. Blood Price.
- applies: hemorrhage · ops: damage, set, removeEffect, apply

### `consume.blood` — Transfusion
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy. If they have Hemorrhage, it ends, and the user heals 10 per stack. If not, the target gains 1 Hemorrhage.
- applies: hemorrhage · ops: damage, if, heal, removeEffect, apply

### `summon.blood` — Blood Elemental
- Summon · cost rr · cooldown 1 · target **self** · tags Helpful, Strategic, BloodPrice
- Summons a Blood Elemental for 3 turns, with HP equal to what the user paid. Blood Lash (nc): 10 damage and 1 Hemorrhage. Blood Price.
- summons: blood_elemental · ops: summon, addMaxHp, heal

### `channel.blood` — Exsanguinate
- Channel · cost rr · cooldown 3 · target **enemy** · tags Harmful, Strategic, Channeled, BloodPrice
- For up to 3 turns, at the end of each of the user's turns, target enemy gains 1 Hemorrhage, and the user heals for what their Hemorrhage deals. Blood Price. Channeled.
- applies: hemorrhage · inline statuses: exsanguinate · ops: apply, heal
  - inline `exsanguinate` (Neutral; triggers: turnEnd): At the end of each of the bearer's turns, the target gains 1 Hemorrhage, and the bearer heals for what their Hemorrhage deals.

### `stab.blood` — Bloodletter's Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, then they gain 1 Hemorrhage for every 30 HP they're missing.
- applies: hemorrhage · ops: damage, apply

### `ravage.blood` — Arterial Strike
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 Piercing damage to target enemy, who gains 2 Hemorrhage. If they're healed before the user's next turn, the healer takes the Hemorrhage instead.
- applies: hemorrhage · inline statuses: arterial_strike · ops: damage, apply
  - inline `arterial_strike` (Debuff): Whoever heals the bearer takes their Hemorrhage (see Hemorrhage).

### `mislead.blood` — Red Herring
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible, BloodPrice
- Target enemy gains 1 Hemorrhage. Then, for 1 turn, the first Harmful skill used by any enemy with Hemorrhage is countered (only one). Blood Price. Invisible.
- applies: hemorrhage · inline statuses: red_herring · ops: apply, removeEffect
  - inline `red_herring` (Debuff, hidden; triggers: skillUsed/counter): The first Harmful skill used by an enemy with Red Herring is countered; then it ends on all of them.

### `stun.blood` — Swoon
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Stunned for up to 2 turns. Healing them ends the Stun.
- applies: stun · inline statuses: swoon · ops: damage, apply, removeEffect
  - inline `swoon` (Debuff; triggers: healed): Healing the bearer ends their Stun.

### `dance.blood` — Danse Sanguine
- Dance · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Hemorrhage. For 3 turns, each time the user damages an enemy with Hemorrhage, that enemy gains 1 more Hemorrhage and the user gains 1 Swiftness (max 2).
- applies: hemorrhage, swiftness · inline statuses: danse_sanguine · ops: apply, if
  - inline `danse_sanguine` (Buff; triggers: dealtDamage): Each time the bearer damages an enemy with Hemorrhage, that enemy gains 1 Hemorrhage and the bearer gains 1 Swiftness (max 2).

### `heal.blood` — Bloodletting
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Removes up to 2 Debuffs from target ally, who heals 15, plus 10 for each Debuff removed.
- ops: set, removeRandom, heal

### `bless.blood` — Blood Doping
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 2 turns, target ally gains 2 Might and 2 Swiftness. When it ends, they're Stunned for 1 turn, which Swiftness can't stop.
- applies: might, swiftness · inline statuses: blood_doping, blood_crash · ops: apply
  - inline `blood_doping` (Buff): When this ends, the bearer is Stunned for 1 turn.
  - inline `blood_crash` (Neutral): Stunned; Swiftness can't stop it.

### `curse.blood` — Hemophilia
- Curse · cost r · cooldown 1 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 2 Hemorrhage, which healing can't remove for 2 turns.
- applies: hemorrhage · inline statuses: hemophilia · ops: apply
  - inline `hemophilia` (Debuff): Healing doesn't stop the bearer's Hemorrhage.

### `smite.blood` — Bloodmark
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 1 Hemorrhage. For 2 turns, allies who damage them heal 5 per Hemorrhage stack they have.
- applies: hemorrhage · inline statuses: bloodmark · ops: damage, apply, heal
  - inline `bloodmark` (Debuff; triggers: damaged): The applier's allies who damage the bearer heal 5 per Hemorrhage on them.

### `prayer.blood` — Blood Chant
- Prayer · cost Irr · cooldown 2 · target **allAllies** · tags Helpful, Strategic, BloodPrice
- All allies heal 20. Until the end of the user's next turn, their allies' random costs are paid in HP, 10 each. Blood Price.
- inline statuses: blood_chant · ops: heal, apply
  - inline `blood_chant` (Buff): The bearer's random costs are paid with 10 HP each.

### `cleave.blood` — Crimson Spray
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Their Hemorrhage ends, and a random other enemy takes 10 damage per stack it had (at least 10).
- ops: damage, forEach, set, removeEffect

### `shout.blood` — Bloodcurdle
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies gain 1 Hemorrhage. For 2 turns, any of them who's healed is also Intimidated for 2 turns.
- applies: hemorrhage, intimidated · inline statuses: bloodcurdle · ops: apply
  - inline `bloodcurdle` (Debuff; triggers: healed): Healing the bearer Intimidates them for 2 turns.

### `withstand.blood` — Clotting Ward
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- For 1 turn, direct hits on the user deal half damage, and the user gains 1 Hemorrhage for every 20 damage this prevents. At the end of their next turn, after their Hemorrhage ticks, it ends.
- applies: hemorrhage · inline statuses: clotting_ward, clot_closing · ops: setCounter, apply, set, if, removeEffect
  - inline `clotting_ward` (Neutral; triggers: damaged): Direct hits deal half damage; the bearer gains 1 Hemorrhage for every 20 damage this prevents.
  - inline `clot_closing` (Neutral): At the end of the bearer's next turn, after their Hemorrhage ticks, it ends.

### `taunt.blood` — Open Vein
- Taunt · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic
- The user gains 2 Hemorrhage, and target enemy is Taunted by them for 2 turns. Meanwhile, each time an enemy the user Taunted damages them, the user's Hemorrhage moves onto that enemy.
- applies: hemorrhage, taunt · inline statuses: open_vein · ops: apply, if, moveEffects
  - inline `open_vein` (Neutral; triggers: damaged): Each enemy the bearer Taunted who damages them takes the bearer's Hemorrhage.

### `titan.blood` — Crimson Colossus
- Titan · cost Wrr · cooldown 4 · target **self** · tags Helpful, Strategic, BloodPrice
- For 3 turns, the user gains 2 Armor and Immortal, and all of their skills' random costs are paid in HP. Blood Price.
- applies: armor, immortal · inline statuses: crimson_colossus · ops: apply
  - inline `crimson_colossus` (Buff): The bearer's random costs are paid with 10 HP each.

### `bloodbound_familiar_bite` — Bite (minion skill of `bloodbound_familiar`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy.
- ops: damage

### `blood_elemental_lash` — Blood Lash (minion skill of `blood_elemental`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains 1 Hemorrhage.
- applies: hemorrhage · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `bloodbound_familiar` — Bloodbound Familiar, 10 HP; skills: bloodbound_familiar_bite
  - passive `bloodbound` (triggers: signal): Damage and healing to it go to its summoner instead; it dies only with them.
- `blood_elemental` — Blood Elemental, 20 HP; skills: blood_elemental_lash

## Named statuses defined here (1) — this group owns their default animations

- `hemorrhage` — Hemorrhage (Debuff; triggers: turnEnd, healed): Max 5. At the end of its applier's turn, the bearer takes 5 Affliction per stack, then gains another stack. Any healing the bearer receives removes it entirely. _Applied by skills in: blood._
