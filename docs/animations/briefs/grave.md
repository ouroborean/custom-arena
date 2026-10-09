# Grave — animation brief

Group id: `grave`. Element(s): Earth + Unholy. Concept file: `docs/animations/concepts/grave.yaml`.
Skill source: `packages/content/data/fusions/grave/skills.grave.yaml`; minions: `packages/content/data/fusions/grave/minions.grave.yaml`; statuses: `packages/content/data/fusions/grave/statuses.grave.yaml`; macros: `packages/content/data/fusions/grave/macros.grave.yaml`.

## Skills (34)

### `strike.grave` — Gravedigger's Spade
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. The user spends 1 Grave, if they have one, for 10 more; with none, they dig 1 Grave instead.
- macros: spend_1, dig · ops: macro, if, damage

### `smash.grave` — Split the Earth
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies. If the user has a Boulder, one of them is destroyed, and the user gains a Soul Fragment for each enemy hit.
- applies: soul_fragment · ops: damage, if, kill, apply

### `charge.grave` — Tomb Rush
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user spends up to 2 Graves, and their next skill costs 1 less per Grave spent.
- inline statuses: tomb_rush · macros: spend_2 · ops: damage, macro, apply
  - inline `tomb_rush` (Buff): The bearer's next skill costs 1 less per stack.

### `riposte.grave` — Grasping Hands
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; a Skeleton is summoned for the user, spending no Grave, and Taunts that skill's user for 1 turn. Invisible.
- applies: taunt · inline statuses: grasping_hands · summons: skeleton · ops: apply, summon
  - inline `grasping_hands` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer; a Skeleton is summoned for them and Taunts that skill's user for 1 turn.

### `rage.grave` — Call the Dead
- Rage · cost SS · cooldown 4 · target **self** · tags Helpful, Strategic
- Raise: the user spends up to 2 Graves for as many Skeletons. For 3 turns, they're Immune and gain 1 Might whenever one of their minions dies.
- applies: immune, might · inline statuses: call_the_dead · macros: spend_2, raise_spent · ops: macro, apply, if
  - inline `call_the_dead` (Buff; triggers: signal): Each allied minion that dies gives the bearer 1 Might.

### `shot.grave` — Barrow Stone
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user spends 1 Grave, if they have one, for a Boulder.
- macros: spend_1 · summons: boulder · ops: damage, macro, if, summon

### `snipe.grave` — Grave Burrower
- Snipe · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled
- In 2 turns, deals 55 damage to target enemy. If any unit or minion dies before then, it lands at once instead. Channeled.
- inline statuses: grave_burrower · ops: apply, damage, removeSelf
  - inline `grave_burrower` (Neutral; triggers: signal): When this runs out, or when anyone dies first, its target takes 55 damage.

### `trap.grave` — Open Grave
- Trap · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, if target enemy kills a unit or minion, they're Stunned for 1 turn and a Skeleton is summoned for the user, spending no Grave. Invisible.
- applies: stun · inline statuses: open_grave · summons: skeleton · ops: apply, if, summon, removeSelf
  - inline `open_grave` (Debuff, hidden; triggers: signal): If the bearer kills anyone, they're Stunned for 1 turn and a Skeleton is summoned for the applier.

### `maneuver.grave` — Bury Yourself
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. When it ends, they spend up to 2 Graves and gain 15 Shield per Grave spent.
- applies: invulnerable, shield · inline statuses: bury_yourself · macros: spend_2 · ops: apply, macro, if
  - inline `bury_yourself` (Neutral): When this runs out, the bearer spends up to 2 Graves for 15 Shield each.

### `companion.grave` — Ghoul Gravedigger
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Ghoul Gravedigger (40 HP) permanently. Gnaw (nc): 10 damage, and it heals 10. Unearth (r): spends 2 of the user's Graves to Raise a Skeleton; with fewer, it digs 1 Grave.
- summons: ghoul_gravedigger · ops: summon

### `bolt.grave` — Deathbolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, +10 for each Soul Fragment the user spends, up to 3. If it kills them, the spent fragments return to the user, with 1 more.
- applies: soul_fragment · ops: set, repeat, removeStacks, damage, if, apply

### `blast.grave` — Uprising
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Raise: the user spends up to 2 Graves for as many Skeletons; for each one, a random enemy takes 15 damage. Then deals 20 damage to all enemies.
- macros: spend_2 · summons: skeleton · ops: macro, repeat, summon, damage

### `consume.grave` — Marrow Draught
- Consume · cost r · cooldown 2 · target **self** · tags Harmful, Strategic
- If there's no allied minion, a Skeleton is summoned for the user first, spending no Grave. Then drains 10 HP from every minion on both sides; the user heals the total. Minions that die leave Graves as usual.
- summons: skeleton · ops: if, summon, set, forEach, damage, heal

### `summon.grave` — Raise Skeletons
- Summon · cost W · cooldown 1 · target **self** · tags Helpful, Strategic
- Raise: the user spends up to 2 Graves for as many Skeletons. With no Graves, the user digs 1 instead.
- macros: spend_2, raise_spent, dig · ops: macro, if

### `channel.grave` — Necropolis
- Channel · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies. For each unit or minion that dies meanwhile, a Skeleton is summoned for the user. Channeled.
- inline statuses: necropolis · summons: skeleton · ops: apply, damage, summon
  - inline `necropolis` (Neutral; triggers: turnEnd, signal): At the end of each of the bearer's turns, deals 10 damage to all enemies; each death summons a Skeleton for the bearer.

### `stab.grave` — Last Rites
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 at or below 60 HP. If that leaves them at 15 HP or less, the user spends 2 Graves, if they have them, to kill them.
- macros: spend_2 · ops: damage, if, macro, kill

### `ravage.grave` — Deathless Drill
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. While the user is Immortal, it also costs them 20 HP and deals 20 more.
- ops: if, damage

### `mislead.grave` — Premature Burial
- Mislead · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and its cooldown rises by 3. Invisible.
- inline statuses: premature_burial · ops: apply, adjustCooldowns
  - inline `premature_burial` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and its cooldown rises by 3.

### `stun.grave` — Buried Alive
- Stun · cost Ar · cooldown 4 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn, plus 1 more turn for each Grave the user spends, up to 2.
- applies: stun · macros: spend_2 · ops: macro, apply

### `dance.grave` — Graveside Vigil
- Dance · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- The user gains 5 Shield per Grave, up to 25, until the end of their next turn. If they already had Shield from this skill, they dig 1 Grave first.
- inline statuses: graveside_vigil · macros: dig · ops: if, macro, apply
  - inline `graveside_vigil` (Buff): Absorbs damage.

### `heal.grave` — Feast of the Fallen
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Spends 1 Grave: target ally heals 30. With no Grave to spend, they heal 10.
- macros: spend_1 · ops: macro, heal

### `bless.grave` — Epitaph
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Might for 3 turns. If they die meanwhile, each of their allies gains a copy of every Buff they had, for its remaining duration.
- applies: might · inline statuses: epitaph · ops: apply, if, copyEffects, removeSelf
  - inline `epitaph` (Neutral; triggers: signal): If the bearer dies, their allies each gain a copy of every Buff they had.

### `curse.grave` — Bitter Soil
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns. Meanwhile, each Helpful skill they use while Horrified summons a Seedling for the user.
- applies: confusion · inline statuses: bitter_soil · summons: seedling · ops: apply, if, summon
  - inline `bitter_soil` (Debuff; triggers: skillUsed): Each Helpful skill the bearer uses while Horrified summons a Seedling for the applier.

### `smite.grave` — Grave Marker
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, each time they're healed, the user gains a Soul Fragment.
- applies: soul_fragment · inline statuses: grave_marker · ops: damage, apply
  - inline `grave_marker` (Debuff; triggers: healed): Each time the bearer is healed, the applier gains a Soul Fragment.

### `prayer.grave` — Requiem
- Prayer · cost Srr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield, and heal 10 more for each unit or minion that died since the user's last turn.
- applies: shield · ops: heal, apply

### `cleave.grave` — Reaper's Row
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy. Then every minion on the field, on both sides, takes 15 damage.
- ops: damage

### `shout.grave` — Tolling Bell
- Shout · cost free · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All units on both sides except the user are Intimidated for 2 turns.
- applies: intimidated · ops: apply

### `withstand.grave` — Wall of Bones
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 2 turns. When it breaks, a Skeleton is summoned for the user, spending no Grave.
- applies: shield · inline statuses: wall_of_bones · summons: skeleton · ops: apply, if, summon, removeSelf
  - inline `wall_of_bones` (Buff; triggers: shieldDamaged): When the bearer's Shield breaks, a Skeleton is summoned for them.

### `taunt.grave` — Grudge Beyond the Grave
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. If the user dies meanwhile, a Ghoul is summoned in their place, spending no Grave, and that enemy is Taunted by the Ghoul for 1 turn.
- applies: taunt · inline statuses: grudge · summons: ghoul · ops: apply, if, summon, removeSelf
  - inline `grudge` (Debuff; triggers: signal): If the applier dies, a Ghoul is summoned in their place and Taunts the bearer.

### `titan.grave` — Lord of the Grave
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Immune, and their minions are Immortal.
- applies: armor, immune, immortal · ops: apply

### `skeleton_rattle_blade` — Rattle Blade (minion skill of `skeleton`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

### `ghoul_gnaw` — Gnaw (minion skill of `ghoul`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and the Ghoul heals 10.
- ops: damage, heal

### `gravedigger_gnaw` — Gnaw (minion skill of `ghoul_gravedigger`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and the Ghoul heals 10.
- ops: damage, heal

### `gravedigger_unearth` — Unearth (minion skill of `ghoul_gravedigger`)
- Minion · cost r · cooldown 0 · target **self** · tags Helpful, Strategic
- Spends 2 of its creator's Graves to Raise a Skeleton; with fewer, it digs them 1 Grave.
- summons: skeleton · ops: if, setCounter, summon

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `skeleton` — Skeleton, 20 HP; skills: skeleton_rattle_blade
- `ghoul` — Ghoul, 30 HP; skills: ghoul_gnaw
- `ghoul_gravedigger` — Ghoul Gravedigger, 40 HP; skills: gravedigger_gnaw, gravedigger_unearth

## Named statuses defined here (1) — this group owns their default animations

- `grave_keeper` — Gravekeeper (Neutral; triggers: signal): Whenever any unit or minion dies, on either side, this character gains 1 Grave (max 6). _Applied by skills in: none directly._

## Macros defined here (4) — this group owns their default animations

- `dig`: ops setCounter. _Used by: grave._
- `spend_1`: ops set, setCounter. _Used by: grave._
- `spend_2`: ops set, setCounter. _Used by: grave._
- `raise_spent`: ops repeat, summon. _Used by: grave._
