# Blight — animation brief

Group id: `blight`. Element(s): Poison + Unholy. Concept file: `docs/animations/concepts/blight.yaml`.
Skill source: `packages/content/data/fusions/blight/skills.blight.yaml`; minions: `packages/content/data/fusions/blight/minions.blight.yaml`; statuses: `packages/content/data/fusions/blight/statuses.blight.yaml`.

## Skills (33)

### `strike.blight` — Rotblade
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 1 Withered. If they now have 3 or more Withered, the user drains a Soul Fragment from them.
- applies: withered, soul_fragment · ops: damage, apply, if

### `smash.blight` — Plaguecrusher
- Smash · cost SS · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 damage to target enemy, who gains 1 Withered. Each of their allies takes 5 damage per Withered the target has.
- applies: withered · ops: damage, apply

### `charge.blight` — Dread Lunge
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. Until the end of the user's next turn, they count as Horrified, whether they are or not.
- inline statuses: dread_lunge · ops: damage, apply
  - inline `dread_lunge` (Debuff): Counts as Horrified.

### `riposte.blight` — Festering Spite
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user gains 2 Withered. Invisible.
- applies: withered · inline statuses: festering_spite · ops: apply
  - inline `festering_spite` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; its user Withers.

### `rage.blight` — Rot Frenzy
- Rage · cost W · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 2 Withered. Then, for 3 turns, they gain 1 Might per Withered on them and are Immortal.
- applies: withered, might, immortal · ops: apply

### `shot.blight` — Bitter Bile
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and, if the user has fewer than 3 Soul Fragments, drains one from them. The user gains 1 Toxin.
- applies: soul_fragment, toxin · ops: damage, if, apply

### `snipe.blight` — Rotspear
- Snipe · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, target enemy takes 20 Affliction damage, and all the user's Toxin moves onto them. The target of this skill is invisible. Channeled.
- inline statuses: rotspear · ops: apply, damage, moveEffects
  - inline `rotspear` (Neutral): When this runs out, its target takes 20 Affliction, and the bearer's Toxin moves onto them.

### `trap.blight` — Rotten Remedy
- Trap · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy is healed, it's undone, and they gain 1 Withered per 10 it would have healed. Invisible.
- applies: withered · inline statuses: rotten_remedy · ops: apply, damage
  - inline `rotten_remedy` (Debuff, hidden; triggers: healed): The bearer's first healing is undone and becomes Withered.

### `maneuver.blight` — Seep Away
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. At the start of their next turn, the Toxin they applied ticks once more.
- applies: invulnerable · inline statuses: seep_away · ops: apply, forEach, damage
  - inline `seep_away` (Buff; triggers: turnStart): At the start of the bearer's next turn, their Toxin on enemies ticks once more.

### `companion.blight` — Plague Rats
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Plague Rat swarm (25 HP) permanently. Plague Bite (r): 5 Piercing damage and 1 Withered. Scurry (nc): 5 Piercing damage to each Withered enemy.
- summons: plague_rats · ops: summon

### `bolt.blight` — Plague Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 1 Withered and is Horrified for 1 turn. While Horrified, their Withered can't be cleansed.
- applies: withered, horrified · inline statuses: plague_bolt · ops: damage, apply
  - inline `plague_bolt` (Debuff): While Horrified, the bearer's Withered can't be cleansed.

### `blast.blight` — Leveling Plague
- Blast · cost II · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- The enemy with the least HP takes 15 Affliction damage. Every other enemy takes Affliction damage equal to how much more HP they have than that enemy, up to 35.
- ops: set, forEach, if, damage

### `consume.blight` — Drink the Plague
- Consume · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it. The user's Toxin is removed, and they gain 1 Soul Fragment per 3 stacks removed (max 2).
- applies: soul_fragment · ops: damage, heal, set, removeEffect, apply

### `summon.blight` — Plague Imp
- Summon · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Plague Imp (25 HP) for 3 turns. Rotbolt (r): 10 Affliction damage and 1 Toxin. When the Imp dies, each enemy it damaged gains 1 Withered.
- summons: plague_imp · ops: summon

### `channel.blight` — Long Decay
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 2 turns, +1 turn per Withered enemy, at the end of each of the user's turns, deals 10 Affliction damage to all enemies. Channeled.
- inline statuses: long_decay · ops: apply, damage
  - inline `long_decay` (Neutral; triggers: turnEnd): Each turn, 10 Affliction damage to all enemies.

### `stab.blight` — Rusted Knife
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 Piercing damage to target enemy. Then, if the user has a Soul Fragment, they spend one, and the target gains 2 Withered.
- applies: withered · ops: damage, if, removeStacks, apply

### `ravage.blight` — Flay
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 Piercing damage to target enemy. Each Buff on them is removed and becomes 1 Withered.
- applies: withered · ops: damage, set, removeKind, apply

### `mislead.blight` — Tainted Offering
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Helpful skill, it's countered, and each unit it would have helped gains 1 Withered. Invisible.
- applies: withered · inline statuses: tainted_offering · ops: apply
  - inline `tainted_offering` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Helpful skill is countered, and each unit it would have helped Withers.

### `stun.blight` — Crippling Rot
- Stun · cost AW · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who is Stunned for 1 turn and gains 1 Withered. Then their Toxin grows by 1 per Withered they have.
- applies: stun, withered, toxin · ops: damage, apply

### `dance.blight` — Rot Waltz
- Dance · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus, and each skill they use gives its first enemy target 1 Withered.
- applies: swiftness, focus, withered · inline statuses: rot_waltz · ops: apply
  - inline `rot_waltz` (Buff; triggers: skillResolved): Each skill the bearer uses gives its first enemy target 1 Withered.

### `heal.blight` — Feast on Fear
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15, +10 for each Horrified enemy.
- ops: heal

### `bless.blight` — Vulture's Blessing
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might and executes any Prey their skills leave at 15 HP or less.
- applies: might · inline statuses: vultures_blessing · ops: apply, forEach, kill
  - inline `vultures_blessing` (Buff; triggers: skillResolved): Prey the bearer's skills leave at 15 HP or less are executed.

### `curse.blight` — Touch of Decay
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Withered and is Confused for 3 turns.
- applies: withered, confusion · ops: apply

### `smite.blight` — Mark of Decay
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each ally who damages them makes their Toxin tick once, healing that ally for it.
- inline statuses: mark_of_decay · ops: damage, apply, if, set, heal
  - inline `mark_of_decay` (Debuff; triggers: damaged): Each direct hit from the applier's side ticks the bearer's Toxin, healing the hitter for it.

### `prayer.blight` — Communion of Rot
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- Each enemy loses 15 HP. All allies heal twice the total lost, split evenly among them.
- ops: set, forEach, damage, heal

### `cleave.blight` — Scything Rot
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to a random other enemy, who gains as much Withered as the first has (max 2).
- applies: withered · ops: damage, set, forEach, apply

### `shout.blight` — Plague Hymn
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Meanwhile, each Helpful skill they use deals 10 Affliction damage to each of its targets.
- applies: intimidated · inline statuses: plague_hymn · ops: apply, damage
  - inline `plague_hymn` (Debuff; triggers: skillResolved): Each Helpful skill the bearer uses deals 10 Affliction damage to each of its targets.

### `withstand.blight` — Bone Carapace
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn. Whoever breaks it has a Soul Fragment drained by the user.
- applies: shield, soul_fragment · inline statuses: bone_carapace · ops: apply, if, removeSelf
  - inline `bone_carapace` (Buff; triggers: shieldDamaged): Whoever breaks the bearer's Shield has a Soul Fragment drained.

### `taunt.blight` — Carrion Stench
- Taunt · cost S · cooldown 4 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Taunted by the user for 1 turn. Until the user's next turn, every hit on the user deals 10 less, but the user can't be healed.
- applies: taunt · inline statuses: carrion_stench · ops: apply
  - inline `carrion_stench` (Buff): Every hit on the bearer deals 10 less, but they can't be healed.

### `titan.blight` — Plague Lord
- Titan · cost WW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Immune, and 5 max HP per Withered stack on enemies (as they are when it's used), healing as it rises.
- applies: armor, immune · inline statuses: plague_lord · ops: apply
  - inline `plague_lord` (Buff): +5 max HP per stack.

### `rats_plague_bite` — Plague Bite (minion skill of `plague_rats`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, who gains 1 Withered.
- applies: withered · ops: damage, apply

### `rats_scurry` — Scurry (minion skill of `plague_rats`)
- Minion · cost free · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to each Withered enemy.
- ops: damage

### `imp_rotbolt` — Rotbolt (minion skill of `plague_imp`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to target enemy, who gains 1 Toxin.
- applies: toxin, imp_bitten · ops: damage, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `plague_rats` — Plague Rats, 25 HP; skills: rats_plague_bite, rats_scurry
- `plague_imp` — Plague Imp, 25 HP; skills: imp_rotbolt

## Named statuses defined here (2) — this group owns their default animations

- `withered` — Withered (Debuff; triggers: turnEnd): Max HP is 5 lower per stack (max 5), and HP above the new max is lost. Lasts until cleansed. Festering: at the end of its applier's turn, the bearer's Toxin gains 1 stack. _Applied by skills in: blight._
- `imp_bitten` — Imp-Bitten (Debuff): When a Plague Imp dies, the bearer gains 1 Withered. _Applied by skills in: blight._
