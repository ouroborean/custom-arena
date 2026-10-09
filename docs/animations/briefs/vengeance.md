# Vengeance — animation brief

Group id: `vengeance`. Element(s): Lightning + Holy. Concept file: `docs/animations/concepts/vengeance.yaml`.
Skill source: `packages/content/data/fusions/vengeance/skills.vengeance.yaml`; minions: `packages/content/data/fusions/vengeance/minions.vengeance.yaml`; statuses: `packages/content/data/fusions/vengeance/statuses.vengeance.yaml`.

## Skills (32)

### `strike.vengeance` — Avenging Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy; it doesn't spend Wrath. If they're the last enemy who damaged the user, the user gains 1 Wrath.
- applies: wrath · ops: damage, if, apply

### `smash.vengeance` — Heaven's Rebuke
- Smash · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies. For 2 turns, when any enemy it hit has their Condemnation trigger, they gain a second random Debuff of its kind.
- applies: weakness, vulnerable, confusion · inline statuses: heavens_rebuke · ops: damage, apply, if, random
  - inline `heavens_rebuke` (Debuff; triggers: skillResolved): When the bearer's Condemnation triggers, they gain a second Debuff from it.

### `charge.vengeance` — Oath Rush
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. The user gains 1 Focus for their next skill, +1 per Wrath spent on this.
- applies: focus · ops: set, damage, apply

### `riposte.vengeance` — Hallowed Feedback
- Riposte · cost I · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the next Harmful skill used on the user, and the user gains 1 Charge. If that fills their Charge, it's spent to Anoint them for 2 turns instead. Invisible.
- applies: charged, anointed · inline statuses: hallowed_feedback · ops: apply, if, removeEffect
  - inline `hallowed_feedback` (Buff, hidden; triggers: skillTargeted/counter): Counters the next Harmful skill used on the bearer, and the bearer gains 1 Charge.

### `rage.vengeance` — Sworn Vengeance
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user has a Vow, and their damage doesn't spend Wrath; when it ends, all their Wrath is spent for Charge.
- applies: vow, charged · inline statuses: sworn_vengeance · ops: apply, removeEffect
  - inline `sworn_vengeance` (Buff): The bearer's damage doesn't spend Wrath; when this ends, it all becomes Charge.

### `shot.vengeance` — Answering Spark
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who is Sanctified until the user's next turn; the user gains 1 Charge each time that Sanctify heals someone.
- applies: sanctify, charged · inline statuses: answering_spark · ops: damage, apply, if
  - inline `answering_spark` (Debuff; triggers: damaged): Each time the bearer's Sanctify heals someone, the applier gains 1 Charge.

### `snipe.vengeance` — Spear of Reprisal
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy. If they hit one of the user's allies before then, it deals 60 Piercing damage to them at once instead. The target of this skill is invisible. Channeled.
- inline statuses: spear_of_the_fallen, spear_of_reprisal · ops: apply, damage, removeEffect
  - inline `spear_of_the_fallen` (Neutral): Deals 40 damage to its target at the end of the following turn; if they hit one of the user's allies first, it deals 60 Piercing damage to them at once instead.
  - inline `spear_of_reprisal` (Neutral, hidden; triggers: dealtDamage): If the bearer hits one of the applier's allies, they take 60 Piercing damage at once.

### `trap.vengeance` — Warrant
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a Harmful skill, every ally of the user gains a Vow for 1 turn before it resolves. Invisible.
- applies: vow · inline statuses: warrant · ops: apply
  - inline `warrant` (Debuff, hidden; triggers: skillUsed): The bearer's first Harmful skill gives every ally of the applier a Vow.

### `maneuver.vengeance` — Vigilant Step
- Maneuver · cost r · cooldown 2 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn, and gains 1 Wrath each time an enemy damages one of their allies meanwhile.
- applies: invulnerable, wrath · inline statuses: vigilant_step · ops: apply
  - inline `vigilant_step` (Buff; triggers: damaged): Each enemy hit on the bearer gives the applier 1 Wrath.

### `companion.vengeance` — Storm Griffin
- Companion · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- Summons a Storm Griffin (45 HP) permanently, with a Vow that never ends. Righteous Strike (W): 15 damage and Sanctify.
- summons: storm_griffin · ops: summon

### `bolt.vengeance` — Rebuking Bolt
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Marked for 1 turn. If Wrath adds to it, their non-Strategic skills are also stunned for 1 turn.
- applies: mark, stun_ns · ops: set, damage, apply, if

### `blast.vengeance` — Found Wanting
- Blast · cost IW · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 10 damage to all enemies, and each takes as much again as the damage they dealt the user since the user's last turn (max 40 more).
- ops: forEach, damage

### `consume.vengeance` — Siphon Grace
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, and the user heals 10. Their Wrath is spent on healing instead of damage: 15 more per stack.
- ops: set, removeEffect, damage, heal

### `summon.vengeance` — Herald of Vengeance
- Summon · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Herald (20 HP) for 3 turns with a Vow; when it dies or expires, the user gains its Wrath. Denounce (r): 10 damage to target enemy.
- summons: herald_of_vengeance · ops: summon

### `channel.vengeance` — Vigil of Wrath
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, the user has a Vow while channeling, and at the end of each of their turns deals 5 damage to all enemies, with Wrath adding (and spent). Channeled.
- applies: charged, vow · inline statuses: vigil_of_wrath · ops: apply, damage, if, removeEffect
  - inline `vigil_of_wrath` (Neutral; triggers: turnEnd): Each turn, 5 damage to all enemies with the bearer's Wrath added.

### `stab.vengeance` — Point of Reckoning
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If that leaves them at or below 60 HP, the user gains 1 Wrath at the end of the turn.
- applies: wrath · inline statuses: point_of_reckoning · ops: damage, if, apply
  - inline `point_of_reckoning` (Neutral): At the end of the turn, the bearer gains 1 Wrath.

### `ravage.vengeance` — Clemency
- Ravage · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 45 Piercing damage to target enemy. If they use no Harmful skill on their next turn, they heal 25.
- inline statuses: clemency · ops: damage, apply, removeSelf, heal
  - inline `clemency` (Buff; triggers: skillUsed): If the bearer uses no Harmful skill this turn, they heal 25 at its end.

### `mislead.vengeance` — Swift Reprisal
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and the user deals them 15 damage at once, with Wrath adding. Invisible.
- applies: charged · inline statuses: swift_reprisal · ops: apply, damage, if, removeEffect
  - inline `swift_reprisal` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and the applier deals them 15 damage, with Wrath adding.

### `stun.vengeance` — Chastening Shock
- Stun · cost AI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Condemned. When the Condemnation triggers, they're also Stunned for 1 turn.
- applies: condemned, stun · inline statuses: chastening_shock · ops: damage, apply
  - inline `chastening_shock` (Debuff; triggers: skillUsed): When the bearer's Condemnation triggers, they're Stunned for 1 turn.

### `dance.vengeance` — Heaven's Tempest
- Dance · cost SA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, 2 Swiftness and a Vow; reaching 3 Wrath makes them Invulnerable for 1 turn.
- applies: might, swiftness, vow, invulnerable · inline statuses: heavens_tempest · ops: apply, if
  - inline `heavens_tempest` (Buff; triggers: effectGained): Reaching 3 Wrath makes the bearer Invulnerable for 1 turn.

### `heal.vengeance` — Spark of Mercy
- Heal · cost A · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20. Each time their Charge turns into energy in the next 2 turns, they heal 10.
- inline statuses: spark_of_mercy · ops: heal, apply
  - inline `spark_of_mercy` (Buff; triggers: energyFromEffect): Spending Charge heals the bearer 10.

### `bless.vengeance` — Oathbond
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, whenever an enemy damages target ally or the user, both of them gain 1 Wrath.
- applies: wrath · inline statuses: oathbond · ops: apply
  - inline `oathbond` (Buff; triggers: damaged): When an enemy damages the bearer, every ally with Oathbond gains 1 Wrath.

### `curse.vengeance` — Karmic Debt
- Curse · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns. Meanwhile, each time they deal damage, they take half of it back as Affliction damage.
- applies: confusion · inline statuses: karmic_debt · ops: apply, damage
  - inline `karmic_debt` (Debuff; triggers: dealtDamage): The bearer takes half the damage they deal back as Affliction.

### `smite.vengeance` — Karmic Spark
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Sapped once. For 2 turns, each time they hit one of the user's allies, they're Sapped again.
- applies: sapped · inline statuses: karmic_spark · ops: damage, apply
  - inline `karmic_spark` (Debuff; triggers: dealtDamage): Each time the bearer hits one of the applier's allies, they're Sapped.

### `prayer.vengeance` — Gathering Oath
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield for 1 turn. Then every ally's Charge moves to the user.
- applies: shield · ops: heal, apply, moveEffects

### `cleave.vengeance` — Arc of Justice
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and to every Condemned enemy, or to a random other enemy if none is; each Condemned enemy hit has their Condemnation trigger now.
- applies: weakness, vulnerable, confusion · ops: if, damage, forEach, removeEffect, random, apply

### `shout.vengeance` — Call for Vengeance
- Shout · cost W · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- Every ally gains a Vow for 2 turns; each enemy who gives one of them Wrath is Intimidated for 1 turn.
- applies: vow, intimidated · inline statuses: call_for_vengeance · ops: apply
  - inline `call_for_vengeance` (Buff; triggers: damaged): Enemies who give the bearer Wrath are Intimidated for 1 turn.

### `withstand.vengeance` — Shield of Retribution
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. If it breaks, they gain 3 Wrath.
- applies: wrath · inline statuses: shield_of_retribution, shield_of_retribution_watch · ops: apply
  - inline `shield_of_retribution` (Buff): A Shield; if it breaks, the bearer gains 3 Wrath.
  - inline `shield_of_retribution_watch` (Neutral; triggers: ownEffectEnded): If the Shield breaks, 3 Wrath.

### `taunt.vengeance` — Come and Face Me
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns, and the user has a Vow for as long; each hit from that enemy gives 2 Wrath.
- applies: taunt, vow, wrath · inline statuses: come_and_face_me · ops: apply, if
  - inline `come_and_face_me` (Buff; triggers: damaged): Each hit from the Taunted enemy gives 1 more Wrath.

### `titan.vengeance` — Avenger
- Titan · cost Ar · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor, Immune and a Vow. Every enemy who damages them meanwhile is Sanctified for 1 turn, so allies who damage that enemy heal 15.
- applies: armor, immune, vow, sanctify · inline statuses: avenger · ops: apply
  - inline `avenger` (Buff; triggers: damaged): Enemies who damage the bearer are Sanctified for 1 turn.

### `storm_griffin_righteous_strike` — Righteous Strike (minion skill of `storm_griffin`)
- Minion · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Sanctified for 1 turn.
- applies: sanctify · ops: damage, apply

### `herald_of_vengeance_denounce` — Denounce (minion skill of `herald_of_vengeance`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `storm_griffin` — Storm Griffin, 45 HP; skills: storm_griffin_righteous_strike
  - passive `vow` (triggers: damaged): Each time an enemy damages the bearer with a skill, they gain 1 Wrath.
- `herald_of_vengeance` — Herald of Vengeance, 20 HP; skills: herald_of_vengeance_denounce
  - passive `vow` (triggers: damaged): Each time an enemy damages the bearer with a skill, they gain 1 Wrath.

## Named statuses defined here (3) — this group owns their default animations

- `vow` — Vow (Buff; triggers: damaged): Each time an enemy damages the bearer with a skill, they gain 1 Wrath. _Applied by skills in: vengeance._
- `wrath` — Wrath (Buff; triggers: dealtDamage, skillResolved): Max 3, kept until spent. The bearer's next direct damage deals 10 more per Wrath (to each target), and spending it gives 1 Charge per stack. _Applied by skills in: vengeance._
- `vengeance_ledger` — Ledger of Wrongs (Neutral; triggers: damaged, turnEnd): Remembers the damage each enemy dealt this character since their last turn. _Applied by skills in: none directly._
