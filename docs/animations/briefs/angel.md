# Angel — animation brief

Group id: `angel`. Element(s): Wind + Holy. Concept file: `docs/animations/concepts/angel.yaml`.
Skill source: `packages/content/data/fusions/angel/skills.angel.yaml`; minions: `packages/content/data/fusions/angel/minions.angel.yaml`; statuses: `packages/content/data/fusions/angel/statuses.angel.yaml`; macros: `packages/content/data/fusions/angel/macros.angel.yaml`.

## Skills (33)

### `strike.angel` — Wingstrike
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, the user Wards the ally with the least HP.
- applies: warded · ops: damage, apply

### `smash.angel` — Heaven's Descent
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to their allies. For each enemy it kills, a random ally gains a Halo.
- applies: halo · ops: set, damage, repeat, apply

### `charge.angel` — Swoop
- Charge · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- The user Wards target ally for 1 turn. If a hit is redirected to the user meanwhile, the user begins Rushing; if none is, the ally begins Rushing when the Ward ends.
- applies: warded, rushing · inline statuses: swoop · ops: apply, if, setFlag
  - inline `swoop` (Buff; triggers: signal): If a hit is redirected to the Angel, they begin Rushing; if not, the bearer does when this ends.

### `riposte.angel` — Intercession
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user Wards every ally and counters the first Harmful skill aimed at the user or redirected to them. Invisible.
- applies: warded · inline statuses: intercession · ops: apply
  - inline `intercession` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill aimed at the bearer.

### `rage.angel` — Unbroken Wings
- Rage · cost A · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, Immune and a Halo. If the Halo saves them, they gain 2 Might and the Rage lasts 2 turns longer.
- applies: might, immune, halo · inline statuses: unbroken_wings · ops: apply, if, setFlag, extendEffects
  - inline `unbroken_wings` (Buff; triggers: damaged): If the Halo saves the bearer, they gain 2 Might and this lasts 2 turns longer.

### `shot.angel` — Quill of Light
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. For 1 turn, if they use a Harmful skill, once it resolves they take 10 damage, and each unit on the user's side it targeted heals 10.
- inline statuses: quill_of_light · ops: damage, apply, heal
  - inline `quill_of_light` (Debuff; triggers: skillResolved): After the bearer's next Harmful skill resolves, they take 10 damage, and each of its targets on the applier's side heals 10.

### `snipe.angel` — Descending Spear
- Snipe · cost Arr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- For 1 turn, the user Wards every ally. If no hit is redirected to them meanwhile, target enemy takes 40 damage on the following turn; if any is, the user heals 20 for each hit redirected instead. The target of this skill is invisible. Channeled.
- applies: warded · inline statuses: descending_spear · ops: setCounter, apply, if, heal, damage
  - inline `descending_spear` (Neutral; triggers: signal): Deals 40 damage to its target at the end of the following turn, unless a hit is redirected to the bearer first; then it heals the bearer 20 per redirected hit instead.

### `trap.angel` — Watchful Eye
- Trap · cost r · cooldown 2 · target **allAllies** · tags Helpful, Strategic, Invisible
- For 2 turns, each ally of the user has a hidden Halo; if it saves them, the one who struck them is Condemned for 2 turns. Invisible.
- applies: condemned · inline statuses: watchful_eye · macros: halo_save · ops: apply, if, removeSelf, forEach, macro
  - inline `watchful_eye` (Buff, hidden; triggers: damaged): Saves the bearer once from death, and Condemns the attacker.

### `maneuver.angel` — Take Flight
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains Leaping, but their other ally with the least HP becomes Invulnerable for 1 turn instead of them. With no other ally, the user becomes Invulnerable.
- applies: leaping, invulnerable · ops: removeEffect, apply, if

### `companion.angel` — Cherub
- Companion · cost AI · cooldown 4 · target **self** · tags Helpful, Strategic
- Summons a Cherub (35 HP) permanently. Shelter (W): the Cherub Wards target ally for 1 turn. Holy Arrow (r): 15 damage and Sanctify.
- summons: cherub · ops: summon

### `bolt.angel` — Beam from Above
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Then the ally with the least HP, the user included, heals as much as it dealt.
- ops: damage, heal

### `blast.angel` — Endless Verdict
- Blast · cost Ar · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to all enemies. For 2 turns, their Condemnations don't end when they trigger.
- inline statuses: endless_verdict · ops: damage, apply
  - inline `endless_verdict` (Debuff): The bearer's Condemnation doesn't end when it triggers.

### `consume.angel` — Grace Received
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it; the user also takes their Swiftness, healing 10 per stack.
- ops: damage, set, moveEffects, heal

### `summon.angel` — Heavenly Host
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons 2 Lesser Angels (10 HP) for 3 turns. Meanwhile, the first time an ally would die, a Lesser Angel dies in their place and they heal to 25. Soothe (r): target ally heals 10.
- inline statuses: heavenly_host · macros: halo_save · summons: lesser_angel · ops: summon, apply, if, kill, forEach, macro, removeEffect
  - inline `heavenly_host` (Buff; triggers: damaged): The first time the bearer would die, a Lesser Angel dies in their place.

### `channel.angel` — Vigil
- Channel · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Channeled
- For 3 turns, the user Wards the ally with the least HP, and at the end of each of their turns, every enemy whose hit was redirected to them takes 15 damage. Channeled.
- applies: vigil_mark, warded · inline statuses: vigil · ops: apply, if, damage
  - inline `vigil` (Neutral; triggers: signal, turnEnd): Wards the weakest ally; enemies whose hits are redirected to the bearer take 15 each turn.

### `stab.angel` — Piercing Feather
- Stab · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 1 turn, they can't target a character on the user's team who is at or below 40 HP with a single-target skill.
- inline statuses: piercing_feather · ops: damage, apply
  - inline `piercing_feather` (Debuff): Can't target an enemy character at or below 40 HP with a single-target skill.

### `ravage.angel` — Plummet
- Ravage · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- The user Leaps. At the start of their next turn, they deal 30 Piercing damage to target enemy, with the Leap's bonus.
- inline statuses: plummet · macros: leap · ops: forEach, macro, apply, damage
  - inline `plummet` (Neutral): Deals 30 Piercing damage to the target when this ends.

### `mislead.angel` — Martyr's Wings
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, the user gains a Halo first, and the enemy is Taunted by the user for 1 turn. Invisible.
- applies: halo, taunt · inline statuses: martyrs_wings · ops: apply
  - inline `martyrs_wings` (Debuff, hidden; triggers: skillUsed): The bearer's next Harmful skill gives the applier a Halo, and the bearer is Taunted by the applier for 1 turn.

### `stun.angel` — Glorious Light
- Stun · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 1 turn and gains a Halo for 2 turns.
- applies: stun, halo · ops: apply

### `dance.angel` — Wings of Respite
- Dance · cost AW · cooldown 5 · target **self** · tags Helpful, Strategic
- For 4 turns, the user gains 1 Might and 2 Swiftness. Whenever an ally would be Stunned meanwhile, the user spends 1 Swiftness to prevent it.
- applies: might, swiftness · inline statuses: wings_of_respite · ops: apply, removeStacks
  - inline `wings_of_respite` (Buff; triggers: incomingNegated): While the Angel has Swiftness, each Stun on the bearer is prevented, and the Angel loses 1 Swiftness.

### `heal.angel` — Lay on Hands
- Heal · cost Wr · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally heals 20 and gains a Halo for 2 turns; if it's unspent when it fades, they heal 20 more.
- inline statuses: lay_on_hands · macros: halo_save · ops: heal, apply, if, removeSelf, forEach, macro
  - inline `lay_on_hands` (Buff; triggers: damaged): Saves the bearer once from death; unspent, it heals 20 when it fades.

### `bless.angel` — Under My Wing
- Bless · cost A · cooldown 2 · target **ally** · tags Helpful, Strategic
- The user Wards target ally for 2 turns; the ally gains 1 Swiftness.
- applies: warded, swiftness · ops: apply

### `curse.angel` — Fallen Grace
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy loses their mobility buffs; for 2 turns, each mobility buff they would gain Condemns them instead.
- applies: condemned · inline statuses: fallen_grace · ops: removeEffect, apply, eventEffect
  - inline `fallen_grace` (Debuff; triggers: effectGained): Each mobility buff the bearer gains Condemns them instead.

### `smite.angel` — Heavenly Mark
- Smite · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, allies who damage them are Warded by the user for 1 turn.
- applies: warded · inline statuses: heavenly_mark · ops: damage, apply, if
  - inline `heavenly_mark` (Debuff; triggers: damaged): The applier's allies who damage the bearer are Warded by the applier.

### `prayer.angel` — Mercy Unbounded
- Prayer · cost W · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- Every living unit on the field, allies and enemies alike, gains 3 Renew, and 2 Armor for 3 turns.
- applies: renew, armor · ops: apply

### `cleave.angel` — Sweeping Wings
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, then 20 to the last enemy who damaged the user, if that's someone else; if not, 10 to every other enemy.
- ops: damage, if

### `shout.angel` — Last Trumpet
- Shout · cost A · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Taunted by the user for 1 turn.
- applies: taunt · ops: apply

### `withstand.angel` — Spread Wings
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield and Wards every ally for 1 turn; any Shield left when it ends is split among the allies.
- applies: warded, shield · inline statuses: spread_wings · ops: apply
  - inline `spread_wings` (Buff): A Shield; what's left when it ends is split among the bearer's allies.

### `taunt.angel` — Radiant Challenge
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user until they've damaged the user twice, for up to 3 turns. Each of those hits heals every other ally of the user 10.
- applies: taunt · inline statuses: radiant_challenge · ops: apply, if, heal, removeEffect, removeSelf, setFlag
  - inline `radiant_challenge` (Debuff; triggers: dealtDamage): Each hit the bearer lands on the Angel heals the Angel's allies 10; the second ends their Taunt.

### `titan.angel` — Seraphic Form
- Titan · cost AW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and Immune, and their single-target Helpful skills affect every ally at once. Meanwhile, they can't use Harmful skills.
- applies: armor, immune · inline statuses: seraphic_form · ops: apply, if, castSkill
  - inline `seraphic_form` (Buff; triggers: skillResolved): Single-target Helpful skills reach every ally; no Harmful skills.

### `cherub_shelter` — Shelter (minion skill of `cherub`)
- Minion · cost W · cooldown 0 · target **ally** · tags Helpful, Strategic
- The Cherub Wards target ally for 1 turn.
- applies: warded · ops: apply

### `cherub_holy_arrow` — Holy Arrow (minion skill of `cherub`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Sanctified for 1 turn.
- applies: sanctify · ops: damage, apply

### `lesser_angel_soothe` — Soothe (minion skill of `lesser_angel`)
- Minion · cost r · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally heals 10.
- ops: heal

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `cherub` — Cherub, 35 HP; skills: cherub_shelter, cherub_holy_arrow
- `lesser_angel` — Lesser Angel, 10 HP; skills: lesser_angel_soothe

## Named statuses defined here (3) — this group owns their default animations

- `warded` — Warded (Buff): The first Harmful skill aimed at the bearer each turn is redirected to the Angel who Warded them. _Applied by skills in: angel._
- `halo` — Halo (Buff; triggers: damaged): The first time the bearer would die, they heal to 25 HP instead, and the Halo is spent. _Applied by skills in: angel._
- `vigil_mark` — Vigil (Debuff): Struck a Warded ally under Vigil; takes 15 damage at the end of the Angel's turn. _Applied by skills in: angel._

## Macros defined here (1) — this group owns their default animations

- `halo_save`: ops heal, setCounter. _Used by: angel._
