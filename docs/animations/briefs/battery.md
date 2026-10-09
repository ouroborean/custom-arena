# Battery — animation brief

Group id: `battery`. Element(s): Lightning + Poison. Concept file: `docs/animations/concepts/battery.yaml`.
Skill source: `packages/content/data/fusions/battery/skills.battery.yaml`; minions: `packages/content/data/fusions/battery/minions.battery.yaml`; statuses: `packages/content/data/fusions/battery/statuses.battery.yaml`; macros: `packages/content/data/fusions/battery/macros.battery.yaml`.

## Skills (32)

### `strike.battery` — Galvanic Fang
- Strike · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If the user has no Cells, they store 1; if they have any, they spend 1 and the target gains 2 Toxin.
- applies: toxin, cell · ops: damage, if, removeStacks, apply

### `smash.battery` — Toxic Circuit
- Smash · cost SI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, the next skill they use deals 20 damage to each of their allies and Corrodes them for 2 turns.
- applies: corroded · inline statuses: toxic_circuit · ops: damage, apply
  - inline `toxic_circuit` (Debuff; triggers: skillUsed): The bearer's next skill deals 20 damage to each of their allies and Corrodes them for 2 turns.

### `charge.battery` — Jump Start
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user's player gains 2 random energy now and generates 2 less next turn.
- inline statuses: jump_start · ops: damage, gainEnergy, apply
  - inline `jump_start` (Neutral): The bearer's player generates 2 less energy next turn.

### `riposte.battery` — Capacitor
- Riposte · cost W · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the next Harmful skill used on the user; the user stores 1 Cell for each energy that skill cost. Invisible.
- applies: cell · inline statuses: capacitor · ops: apply
  - inline `capacitor` (Buff, hidden; triggers: skillTargeted/counter): Counters the next Harmful skill used on the bearer and stores its cost as Cells.

### `rage.battery` — Thermal Runaway
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might and Immune. Each skill they use meanwhile gives them 1 more Might for as long and deals them 10 Affliction damage.
- applies: might, immune · inline statuses: thermal_runaway · ops: apply, damage
  - inline `thermal_runaway` (Buff; triggers: skillUsed): Each skill the bearer uses gives 1 more Might and deals them 10 Affliction damage.

### `shot.battery` — Afterspark
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy. It strikes again at the start of the user's next turn if they gained any Charge in between.
- inline statuses: afterspark · ops: damage, apply, setFlag, if
  - inline `afterspark` (Neutral; triggers: effectGained): Strikes again at the start of the bearer's next turn if they gained Charge.

### `snipe.battery` — Railgun
- Snipe · cost AI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 30 Piercing damage to target enemy. Discharge: 10 more per Cell; if it kills them, the Cells are stored again. The target of this skill is invisible. Channeled.
- applies: cell · inline statuses: railgun · macros: discharge · ops: apply, macro, forEach, set, damage, if
  - inline `railgun` (Neutral): Fires at the end of the following turn, Discharging every Cell.

### `trap.battery` — Leaking Cell
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a Helpful skill, they take 15 Piercing damage and every unit it affects is Corroded for 2 turns. Invisible.
- applies: corroded · inline statuses: leaking_cell · ops: apply, damage
  - inline `leaking_cell` (Debuff, hidden; triggers: skillUsed): The bearer's first Helpful skill deals them 15 Piercing damage and Corrodes its targets.

### `maneuver.battery` — Electrolysis
- Maneuver · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn, and their Toxin and Sapped turn into Cells, stack for stack.
- applies: invulnerable, cell · ops: apply, set, removeEffect

### `companion.battery` — Bombardier Beetle
- Companion · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Bombardier Beetle (30 HP) permanently; enemies who damage it are Corroded for 2 turns. Acid Jet (r): 10 Piercing damage to target enemy, +10 if they're Corroded.
- summons: bombardier_beetle · ops: summon

### `bolt.battery` — Battery Acid
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Corroded for 2 turns. Each Armor they have turns into 1 Toxin.
- applies: toxin, corroded · ops: damage, set, removeEffect, apply

### `blast.battery` — Full Discharge
- Blast · cost Wrr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies. Discharge: 10 more to each per Cell, and the user is Sapped once per Cell spent.
- applies: sapped · macros: discharge · ops: macro, damage, apply

### `consume.battery` — Leech Line
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 2 Toxin. For 2 turns, at the end of each of the user's turns, the user heals 5 per Toxin the target has and gains 1 Charge.
- applies: toxin, charged · inline statuses: leech_line · ops: apply, heal
  - inline `leech_line` (Debuff; triggers: turnEnd): At the end of each of the applier's turns, they heal 5 per Toxin on the bearer and gain 1 Charge.

### `summon.battery` — Voltaic Wasps
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Voltaic Wasp swarm (15 HP) for 3 turns. Arc Sting (r): 5 Piercing damage and 1 Toxin to target enemy, then 5 Piercing to every other enemy with Toxin.
- summons: voltaic_wasps · ops: summon

### `channel.battery` — Acid Drizzle
- Channel · cost r · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 2 turns, at the end of each of the user's turns, deals 10 damage to all enemies, and each is Corroded for 1 turn. If no enemy has Shield or Armor when a tick lands, a turn is added, once. Channeled.
- applies: corroded · inline statuses: acid_drizzle · ops: apply, damage, if, setFlag, extendSelf
  - inline `acid_drizzle` (Neutral; triggers: turnEnd): Each turn, 10 damage and Corroded on all enemies; once, if no enemy has Shield or Armor, it lasts 1 turn longer.

### `stab.battery` — Shock Prod
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're Corroded; then they're Corroded for 1 turn.
- applies: corroded · ops: damage, apply

### `ravage.battery` — Locked Relay
- Ravage · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, who is Sapped. For 2 turns, while they're Sapped, they generate 1 less energy each turn.
- applies: sapped · inline statuses: locked_relay · ops: damage, apply
  - inline `locked_relay` (Debuff): While Sapped, the bearer generates 1 less energy each turn.

### `mislead.battery` — Short to Ground
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they're Corroded for 2 turns; if they have a Shield, they lose it and take 10 Affliction damage. Invisible.
- applies: corroded · inline statuses: short_to_ground · ops: apply, if, removeShields, damage
  - inline `short_to_ground` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they lose their Shield.

### `stun.battery` — Paralysis
- Stun · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn, and their Toxin deals its damage now as well.
- applies: stun · ops: apply, damage

### `dance.battery` — Voltaic Waltz
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and 2 Swiftness; at the end of each of their turns, they gain 1 Charge per enemy with Toxin.
- applies: might, swiftness, charged · inline statuses: voltaic_waltz · ops: apply
  - inline `voltaic_waltz` (Buff; triggers: turnEnd): Each turn, 1 Charge per enemy with Toxin.

### `heal.battery` — Recharge
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20, and the user moves up to 3 of their Cells to them as Charge.
- applies: charged · ops: heal, set, removeStacks, apply

### `bless.battery` — Adrenal Charge
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might and 2 Renew, and each time they're healed, they also gain 1 Charge.
- applies: might, renew, charged · inline statuses: adrenal_charge · ops: apply
  - inline `adrenal_charge` (Buff; triggers: healed): Each heal gives the bearer 1 Charge.

### `curse.battery` — Low Battery
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns, and their Sapped counts toward Prey for as long.
- applies: confusion · inline statuses: low_battery · ops: apply
  - inline `low_battery` (Debuff): The bearer's Sapped counts toward Prey.

### `smite.battery` — Stripping Brand
- Smite · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Corroded for 2 turns. For 1 turn, allies who damage them heal 10, or 20 once they have no Shield or Armor.
- applies: corroded · inline statuses: stripping_brand · ops: damage, apply, heal
  - inline `stripping_brand` (Debuff; triggers: damaged): The applier's allies who damage the bearer heal 10, or 20 once the bearer has no Shield or Armor.

### `prayer.battery` — Shared Grid
- Prayer · cost WW · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15. Then their HP is pooled: each ally's HP becomes the average of the team's.
- ops: heal, set, forEach, if, damage

### `cleave.battery` — Acid Arc
- Cleave · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy. If the target is Corroded, the other enemy is Corroded for 2 turns; if not, both are Corroded for 1 turn.
- applies: corroded · ops: damage, forEach, if, apply

### `shout.battery` — Overload Alarm
- Shout · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Meanwhile, each skill they use that costs 3 or more energy deals them 15 Affliction damage.
- applies: intimidated · inline statuses: overload_alarm · ops: apply, if, damage
  - inline `overload_alarm` (Debuff; triggers: skillUsed): Each skill costing 3 or more energy deals the bearer 15 Affliction.

### `withstand.battery` — Battery Pack
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 30 Shield for 1 turn; whatever is left of it at the end becomes Cells, 1 per 10.
- applies: cell · inline statuses: battery_pack · ops: apply
  - inline `battery_pack` (Buff): A Shield; what's left when it ends becomes Cells, 1 per 10.

### `taunt.battery` — Etching Glare
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns, and Corroded for as long; the Shield they lose to it goes to the user.
- applies: taunt, shield · inline statuses: etching_glare · ops: apply, if, boostShields
  - inline `etching_glare` (Debuff; triggers: turnEnd): The bearer's Shield loses 10 each turn, which goes to the applier; they can't gain Armor.

### `titan.battery` — Living Battery
- Titan · cost Wr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune, stores 1 Cell at the end of each of their turns, and counts each Cell they hold as 1 Armor.
- applies: immune, cell · inline statuses: living_battery · ops: apply
  - inline `living_battery` (Buff; triggers: turnEnd): Stores 1 Cell at the end of each of the bearer's turns; each Cell held counts as 1 Armor.

### `bombardier_beetle_acid_jet` — Acid Jet (minion skill of `bombardier_beetle`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy, +10 if they're Corroded.
- ops: damage

### `voltaic_wasps_arc_sting` — Arc Sting (minion skill of `voltaic_wasps`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage and 1 Toxin to target enemy, then 5 Piercing to every other enemy with Toxin.
- applies: toxin · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `bombardier_beetle` — Bombardier Beetle, 30 HP; skills: bombardier_beetle_acid_jet
  - passive `bombardier_spray` (triggers: damaged): Enemies who damage it are Corroded for 2 turns.
- `voltaic_wasps` — Voltaic Wasps, 15 HP; skills: voltaic_wasps_arc_sting

## Named statuses defined here (3) — this group owns their default animations

- `cell` — Cell (Neutral): Stored charge (max 5) that never decays. Discharge skills spend all of it. _Applied by skills in: battery._
- `corroded` — Corroded (Debuff; triggers: turnEnd): The bearer's Shield loses 10 at the end of each of the applier's turns, and they can't gain Armor. _Applied by skills in: battery._
- `battery_core` — Battery Core (Neutral; triggers: effectGained): Charge this character gains while at 3 becomes a Cell instead. _Applied by skills in: none directly._

## Macros defined here (1) — this group owns their default animations

- `discharge`: ops set, removeEffect. _Used by: battery._
