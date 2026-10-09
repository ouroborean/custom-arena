# Ghost — animation brief

Group id: `ghost`. Element(s): Wind + Unholy. Concept file: `docs/animations/concepts/ghost.yaml`.
Skill source: `packages/content/data/fusions/ghost/skills.ghost.yaml`; minions: `packages/content/data/fusions/ghost/minions.ghost.yaml`; statuses: `packages/content/data/fusions/ghost/statuses.ghost.yaml`; macros: `packages/content/data/fusions/ghost/macros.ghost.yaml`.

## Skills (32)

### `strike.ghost` — Phantom Blade
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy, who is Haunted for 1 turn. A Haunt already on them ticks now and doesn't drift this turn.
- applies: haunt · ops: damage, if, setCounter, apply

### `smash.ghost` — Poltergeist Crash
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to their allies, and the target is Haunted for 2 turns. If they already were, a random ally of theirs is also Haunted for 2 turns.
- applies: haunt · ops: damage, if, apply

### `charge.ghost` — Walk Through Walls
- Charge · cost free · cooldown 1 · target **self** · tags Helpful, Strategic
- The user is Spectral until they next use a skill, and that skill Bypasses.
- inline statuses: walk_through_walls · ops: apply
  - inline `walk_through_walls` (Buff): No Normal damage until the bearer's next skill, which Bypasses.

### `riposte.ghost` — Vengeful Spirit
- Riposte · cost r · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user is Spectral, and the first enemy to use a Harmful skill on them takes 15 Affliction damage. Invisible.
- applies: spectral · inline statuses: vengeful_spirit · ops: apply, damage
  - inline `vengeful_spirit` (Buff, hidden; triggers: skillTargeted): The first enemy to use a Harmful skill on the bearer takes 15 Affliction damage.

### `rage.ghost` — Unfinished Business
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, and 1 more for each enemy who damages them (up to 3 more). When it ends, each enemy who did is Haunted for 2 turns.
- applies: might, haunt · inline statuses: unfinished_business, grudge · ops: apply, if, forEach, removeEffect
  - inline `unfinished_business` (Buff; triggers: damaged): Each enemy who damages the bearer gives them 1 Might (up to 3) and is Haunted when it ends.
  - inline `grudge` (Neutral): Haunted when the Unfinished Business that marked them ends.

### `shot.ghost` — Phantom Pain
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. For 2 turns, whenever one of their allies takes direct damage, they take 5 Affliction damage too.
- inline statuses: phantom_pain · ops: damage, apply
  - inline `phantom_pain` (Debuff; triggers: damaged): Each time the bearer takes direct damage, the target of Phantom Pain takes 5 Affliction damage.

### `snipe.ghost` — Grave Omen
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- The user is Spectral until it lands; on the following turn, 35 Piercing damage to target enemy. The target of this skill is invisible. Channeled.
- applies: spectral · inline statuses: grave_omen · ops: apply, damage
  - inline `grave_omen` (Neutral): At the end of the following turn, deals 35 Piercing damage to its target.

### `trap.ghost` — Hangman's Noose
- Trap · cost I · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time target enemy gains a Buff, it's removed, and they're Haunted for 3 turns. Invisible.
- applies: haunt · inline statuses: hangmans_noose · ops: apply, eventEffect
  - inline `hangmans_noose` (Debuff, hidden; triggers: effectGained): The bearer's first Buff is removed, and they're Haunted for 3 turns.

### `maneuver.ghost` — Fade
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Spectral for 2 turns; it ends early if they deal damage.
- inline statuses: fade · ops: apply, removeSelf
  - inline `fade` (Buff; triggers: dealtDamage): No Normal damage; ends if the bearer deals damage.

### `companion.ghost` — Poltergeist
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Poltergeist (30 HP, always Spectral) permanently. Rattle (S): 10 Affliction damage, and Haunted for 2 turns.
- summons: poltergeist · ops: summon

### `bolt.ghost` — Reaping Bolt
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Haunted for 1 turn. If that Haunt drifts off them, the user drains a Soul Fragment from them.
- applies: haunt, soul_fragment · inline statuses: reaping_bolt · ops: damage, apply, if, removeStacks
  - inline `reaping_bolt` (Neutral; triggers: turnEnd): If the Haunt drifted off its target this turn, the bearer drains a Soul Fragment from them.

### `blast.ghost` — Spirit Storm
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, +10 for each character on either side who has died this battle (max +40).
- ops: damage

### `consume.ghost` — Steal Breath
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, who is Haunted for 2 turns. Each time that Haunt deals damage, on them or whoever it drifts to, the user heals as much.
- inline statuses: breath_haunt · macros: haunt_drift · ops: damage, apply, heal, forEach, macro
  - inline `breath_haunt` (Debuff; triggers: turnEnd): A Haunt whose damage heals its applier.

### `summon.ghost` — Wraiths
- Summon · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- Summons 2 Wraiths (10 HP) for 3 turns; when a Wraith dies, its killer is Haunted for 2 turns. Cold Grasp (nc): 5 Affliction damage.
- summons: wraith · ops: summon

### `channel.ghost` — Restless Dead
- Channel · cost SA · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, at the end of each of the user's turns, a random enemy not yet hit by this skill (any enemy, once all have been hit) takes 15 Affliction damage and is Horrified for 1 turn. Channeled.
- applies: horrified · inline statuses: restless_dead, restless_struck · ops: apply, if, set, forEach, damage
  - inline `restless_dead` (Neutral; triggers: turnEnd): At the end of each of the user's turns, an enemy not yet hit by this takes 15 Affliction damage and is Horrified for 1 turn.
  - inline `restless_struck` (Neutral): Restless Dead hits enemies without this first.

### `stab.ghost` — Through the Veil
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and 10 damage to a random ally of theirs.
- ops: damage, forEach

### `ravage.ghost` — Rend the Living
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 30 Piercing damage to target enemy. For 2 turns, a Horrify on them also stops them from being healed.
- inline statuses: rend_the_living · ops: damage, apply
  - inline `rend_the_living` (Debuff): While Horrified, the bearer can't be healed.

### `mislead.ghost` — Night Terror
- Mislead · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, all its targets are Spectral against it, taking no Normal damage from it; its user is then Horrified for 2 turns. Invisible.
- applies: spectral, horrified · inline statuses: night_terror · ops: apply
  - inline `night_terror` (Debuff, hidden; triggers: skillUsed): The bearer's next Harmful skill deals no Normal damage to its targets, and the bearer is then Horrified for 2 turns.

### `stun.ghost` — Frozen with Fear
- Stun · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn and Haunted for 2 turns; the first ally of theirs it drifts to is Stunned for 1 turn too.
- applies: stun, haunt · inline statuses: frozen_with_fear · ops: apply
  - inline `frozen_with_fear` (Debuff): The first ally the Haunt drifts to is Stunned too.

### `dance.ghost` — Ghostly Waltz
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Spectral and gains 1 Might and 2 Swiftness, but can't be healed.
- applies: spectral, might, swiftness · inline statuses: ghostly_waltz · ops: apply
  - inline `ghostly_waltz` (Neutral): The bearer can't be healed.

### `heal.ghost` — Soul Transfer
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 15, +10 per Soul Fragment the user spends, up to 2; with 2 spent, the ally also Leaps.
- macros: leap · ops: set, removeStacks, heal, if, forEach, macro

### `bless.ghost` — Spirit Form
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally is Spectral for 2 turns; each Harmful skill an enemy uses on them gives the user a Soul Fragment.
- applies: spectral, soul_fragment · inline statuses: spirit_form · ops: apply
  - inline `spirit_form` (Buff; triggers: skillTargeted): Each Harmful skill an enemy uses on the bearer gives the applier a Soul Fragment.

### `curse.ghost` — Spirit Mark
- Curse · cost r · cooldown 1 · target **enemy** · tags Harmful, Strategic
- Target enemy is Haunted for 3 turns; each ally it drifts to is Horrified for 1 turn as it arrives.
- applies: haunt, spirit_mark · ops: apply

### `smite.ghost` — Unnerving Touch
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Horrified for 1 turn. Each Helpful skill used on them meanwhile gives the user 1 Swiftness instead.
- applies: horrified, swiftness · inline statuses: unnerving_touch · ops: damage, apply
  - inline `unnerving_touch` (Debuff; triggers: skillTargeted): Each Helpful skill used on the bearer gives the applier 1 Swiftness.

### `prayer.ghost` — Dirge of Spirits
- Prayer · cost Arr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. For 2 turns, each ally's Swiftness also negates a Taunt, spending 1 stack.
- inline statuses: dirge_of_spirits · ops: heal, apply, removeStacks
  - inline `dirge_of_spirits` (Buff; triggers: incomingNegated): Swiftness also negates Taunts, 1 stack each.

### `cleave.ghost` — Phantom Sweep
- Cleave · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and gives them Phantom Blade for 2 turns. At the end of each of the user's turns, it moves to a random ally of its bearer, who takes 15 damage.
- inline statuses: phantom_blade · ops: damage, apply, forEach, moveEffects
  - inline `phantom_blade` (Debuff; triggers: turnEnd): At the end of each of its applier's turns, it moves to a random ally of the bearer, who takes 15 damage.

### `shout.ghost` — Keening
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- Every enemy is Haunted for 1 turn, so no Haunt can drift. Each one who was already Haunted is also Intimidated for 2 turns.
- applies: intimidated, haunt · ops: forEach, if, apply

### `withstand.ghost` — Ectoplasmic Shield
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn; when it breaks, they become Spectral for 1 turn.
- applies: spectral · inline statuses: ectoplasmic_shield, ectoplasmic_watch · ops: apply
  - inline `ectoplasmic_shield` (Buff): A Shield; when it breaks, the bearer becomes Spectral.
  - inline `ectoplasmic_watch` (Neutral; triggers: ownEffectEnded): When the Shield breaks, the bearer becomes Spectral for 1 turn.

### `taunt.ghost` — Beckoning Spirit
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- For 3 turns, one enemy at a time is Taunted by the user: target enemy first, and at the end of each of the user's later turns, the Taunt moves to a random ally of theirs.
- applies: beckoner · ops: setCounter, apply

### `titan.ghost` — Second Haunting
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Spectral, but Piercing and Affliction damage hurt them 5 more. The first time a hit would leave them at 1 HP or less meanwhile, they're Vanished instead, and return at the start of their next turn with 30 HP.
- applies: spectral, vanished · inline statuses: second_haunting · ops: apply, if, removeSelf
  - inline `second_haunting` (Buff; triggers: damaged): Piercing and Affliction damage hurt the bearer 5 more; the first time a hit would leave them at 1 HP or less, they're Vanished instead, and return next turn with 30 HP.

### `poltergeist_rattle` — Rattle (minion skill of `poltergeist`)
- Minion · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to target enemy, who is Haunted for 2 turns.
- applies: haunt · ops: damage, apply

### `wraith_cold_grasp` — Cold Grasp (minion skill of `wraith`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Affliction damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `poltergeist` — Poltergeist, 30 HP; skills: poltergeist_rattle
  - passive `spectral`: The bearer takes no Normal damage; Piercing and Affliction still hurt.
- `wraith` — Wraith, 10 HP; skills: wraith_cold_grasp

## Named statuses defined here (5) — this group owns their default animations

- `spectral` — Spectral (Buff): The bearer takes no Normal damage; Piercing and Affliction still hurt. _Applied by skills in: ghost._
- `haunt` — Haunt (Debuff; triggers: turnEnd): At the end of its applier's turn, the bearer takes 10 Affliction, then the Haunt drifts to a random ally of theirs (it stays if they have none). _Applied by skills in: ghost._
- `vanished` — Vanished (Neutral; triggers: turnStart): Can't be targeted or damaged; returns at the start of the bearer's next turn with 30 HP. _Applied by skills in: ghost._
- `spirit_mark` — Spirit Mark (Debuff): Wherever the Haunt drifts, its new bearer is Horrified for 1 turn. _Applied by skills in: ghost._
- `beckoner` — Beckoning Spirit (Debuff; triggers: turnEnd): Taunted by the applier. At the end of each of the applier's later turns, it moves to a random ally of the bearer. _Applied by skills in: ghost._

## Macros defined here (1) — this group owns their default animations

- `haunt_drift`: ops if, forEach, signal, apply, removeEffect, moveEffects; applies stun, horrified. _Used by: ghost._
