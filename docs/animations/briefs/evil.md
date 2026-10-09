# Evil — animation brief

Group id: `evil`. Element(s): Unholy + Unholy. Concept file: `docs/animations/concepts/evil.yaml`.
Skill source: `packages/content/data/fusions/evil/skills.evil.yaml`; minions: `packages/content/data/fusions/evil/minions.evil.yaml`; statuses: `packages/content/data/fusions/evil/statuses.evil.yaml`; macros: `packages/content/data/fusions/evil/macros.evil.yaml`.

## Skills (34)

### `strike.evil` — Cruel Blade
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If they were healed since the user's last turn, they take 10 more and are Unhallowed for 2 turns.
- applies: unhallowed · ops: set, damage, if, apply

### `smash.evil` — Soulgrinder
- Smash · cost SS · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. For 2 turns, at the end of each of the user's turns, they take 10 Affliction damage, each of their allies takes 5, and the user drains a Soul Fragment from them.
- inline statuses: soulgrinder · macros: drain_it · ops: damage, apply, forEach, macro
  - inline `soulgrinder` (Debuff; triggers: turnEnd): At the end of each of the user's turns, 10 Affliction to the bearer and 5 to each of their allies, and the user drains a Soul Fragment from the bearer.

### `charge.evil` — Soul Hunt
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and drains a Soul Fragment from them. If an enemy hits the user before their next turn, that enemy drains a Soul Fragment back from the user.
- applies: soul_fragment · inline statuses: soul_hunt · macros: drain_it · ops: damage, forEach, macro, apply, if, removeStacks
  - inline `soul_hunt` (Neutral; triggers: damaged): The first enemy to hit the bearer drains a Soul Fragment back from them.

### `riposte.evil` — Take You With Me
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user. If the user dies before the end of their next turn, the last enemy it countered dies with them. Invisible.
- inline statuses: take_you_with_me, doomed_together · ops: apply, removeEffect, if, kill
  - inline `take_you_with_me` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer, and gives each countered enemy Doomed Together.
  - inline `doomed_together` (Debuff; triggers: signal): If the applier dies before this ends, the bearer dies too.

### `rage.evil` — Atrocity
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 2 turns, the user is Immortal, and each enemy who damages them loses a Soul Fragment to the user.
- applies: immortal · inline statuses: atrocity · macros: drain_it · ops: apply, forEach, macro
  - inline `atrocity` (Buff; triggers: damaged): Each enemy who damages the bearer loses a Soul Fragment to them.

### `shot.evil` — Bone Needle
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- If the user has a Soul Fragment, they spend it to deal 25 Piercing damage to target enemy. Otherwise, deals 10 damage to target enemy and drains a Soul Fragment from them.
- macros: tithe, drain_it · ops: set, macro, if, damage, forEach

### `snipe.evil` — Doom Knell
- Snipe · cost SA · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- In 3 turns, deals 70 Affliction damage to target enemy. Each time they're healed meanwhile, it lands a turn sooner. The target of this skill is invisible. Channeled.
- inline statuses: doom_knell, doom_knell_mark · ops: apply, damage, extendEffects
  - inline `doom_knell` (Neutral): When this ends, deals 70 Affliction damage to its target. It ends sooner each time they're healed.
  - inline `doom_knell_mark` (Debuff, hidden; triggers: healed): Each time the bearer is healed, Doom Knell lands a turn sooner.

### `trap.evil` — Damning Shackle
- Trap · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 2 turns, the first time target enemy would be healed, they take that much Affliction damage instead and are Stunned for 1 turn. Invisible.
- applies: stun · inline statuses: damning_shackle · ops: apply
  - inline `damning_shackle` (Debuff, hidden; triggers: healed): The first time the bearer would be healed, they take that much Affliction damage instead and are Stunned for 1 turn.

### `maneuver.evil` — Deathless Step
- Maneuver · cost I · cooldown 2 · target **self** · tags Helpful, Strategic
- The user gains a Soul Fragment. For 1 turn, each time they'd lose HP, they lose a Soul Fragment instead; once they have none left, HP is lost as usual.
- applies: soul_fragment · inline statuses: deathless_step · ops: apply, if, removeStacks
  - inline `deathless_step` (Buff; triggers: damaged): Each time the bearer would lose HP, they lose a Soul Fragment instead (while they have one).

### `companion.evil` — Fiend
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Fiend (35 HP) permanently. Rend Soul (S): 15 Affliction damage and Unhallowed for 1 turn. Feast (r): drains a Soul Fragment from a Horrified enemy for its summoner.
- summons: fiend · ops: summon

### `bolt.evil` — Profane Bolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. For 2 turns, each Buff they gain costs them 10 HP.
- inline statuses: profane_bolt · ops: damage, apply
  - inline `profane_bolt` (Debuff; triggers: effectGained): Each Buff the bearer gains costs them 10 HP.

### `blast.evil` — Soulfire Nova
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 45 damage to all enemies. Then the user and each of their allies are Unhallowed for 2 turns.
- applies: unhallowed · ops: damage, apply

### `consume.evil` — Reap
- Consume · cost S · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Every enemy takes 5 damage and is Horrified for 1 turn. The user drains a Soul Fragment from the one with the least HP and heals 10.
- applies: horrified · macros: drain_it · ops: damage, forEach, macro, heal, apply

### `summon.evil` — Tormentor
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Tormentor (25 HP) for 3 turns. Barbed Whip (r): 10 Affliction damage. False Mercy (I): target enemy is Unhallowed for 1 turn; if it's applied, they then heal 15.
- summons: tormentor · ops: summon

### `channel.evil` — Undying Thirst
- Channel · cost rr · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled
- For 3 turns, deals 10 damage to target enemy each turn, with Lifesteal. While it channels, the user is Immortal, but only this Lifesteal can heal them. Channeled.
- inline statuses: undying_thirst, undying_thirst_hold · ops: apply, damage, heal
  - inline `undying_thirst` (Neutral; triggers: turnEnd): At the end of each of the user's turns, deals 10 damage to its target, with Lifesteal.
  - inline `undying_thirst_hold` (Buff): Immortal, and only Undying Thirst's own Lifesteal can heal the bearer.

### `stab.evil` — Heartpiercer
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If that leaves them at or below 30 HP, they're Unhallowed for 2 turns.
- applies: unhallowed · ops: damage, if, apply

### `ravage.evil` — Mutual Ruin
- Ravage · cost free · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 Piercing damage to target enemy. Costs no energy: instead, the user loses 25 HP, which can't kill them.
- ops: damage

### `mislead.evil` — Waking Nightmare
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Helpful skill, it's countered, and its targets take the healing it would have given as Affliction damage. Invisible.
- inline statuses: waking_nightmare · ops: apply, damage
  - inline `waking_nightmare` (Debuff, hidden; triggers: skillUsed/counter): The bearer's first Helpful skill is countered, and its targets take the healing it would have given as Affliction damage.

### `stun.evil` — Cruel Mercy
- Stun · cost SA · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 2 turns, but Immortal for as long: nothing can take them below 5 HP meanwhile.
- applies: stun, immortal · ops: apply

### `dance.evil` — Danse Macabre
- Dance · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 Piercing damage to target enemy, and the user gains 1 Confusion for 2 turns. For those 2 turns, the user's Confusion lowers their skill costs instead of raising them.
- applies: confusion · inline statuses: danse_macabre · ops: damage, apply
  - inline `danse_macabre` (Buff): The bearer's Confusion lowers their skill costs instead of raising them.

### `heal.evil` — Borrowed Blood
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 35. At the end of each of their next 2 turns, they lose 10 HP unless they damaged an enemy that turn.
- inline statuses: borrowed_blood · ops: heal, apply, setFlag, if, damage
  - inline `borrowed_blood` (Debuff; triggers: dealtDamage, turnEnd): At the end of the bearer's turn, they lose 10 HP unless they damaged an enemy that turn.

### `bless.evil` — Dark Gift
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- The user gives up 1 Soul Fragment, and target ally gains 2; after 2 turns, the ally loses 1 of them. With none to give up, the user loses 15 HP instead, and the ally loses both after 2 turns.
- applies: soul_fragment · inline statuses: dark_gift · macros: tithe · ops: set, macro, if, damage, apply, repeat, removeStacks
  - inline `dark_gift` (Neutral): When this ends, the bearer loses 1 Soul Fragment, or 2 if the user had none to give up.

### `curse.evil` — Eternal Torment
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains 1 Confusion and is Immortal for 3 turns. Each hit that would have taken them below 5 HP gives its dealer a Soul Fragment.
- applies: confusion, immortal, soul_fragment · inline statuses: eternal_torment · ops: apply, if
  - inline `eternal_torment` (Debuff; triggers: damaged): Each hit that leaves the bearer at their Immortal floor gives its dealer a Soul Fragment.

### `smite.evil` — Soul Rot
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Tithe 1: for 2 turns, each ally who damages them gains a Soul Fragment.
- applies: soul_fragment · inline statuses: soul_rot · macros: tithe · ops: damage, set, macro, if, apply
  - inline `soul_rot` (Debuff; triggers: damaged): Each enemy who damages the bearer gains a Soul Fragment.

### `prayer.evil` — Black Mass
- Prayer · cost Srr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 25. Then each ally at full HP loses 10 HP and gains 1 Soul Fragment.
- applies: soul_fragment · ops: heal, forEach, damage, apply

### `cleave.evil` — Spreading Agony
- Cleave · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Each of their allies takes 5 Affliction damage for every 20 HP the target is now missing (at least 5, at most 15).
- ops: set, damage

### `shout.evil` — Wail of the Damned
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Unhallowed until the end of their next turn; any of them healed during it are also Horrified for 2 turns.
- applies: unhallowed, horrified · inline statuses: wail_of_the_damned · ops: apply
  - inline `wail_of_the_damned` (Debuff; triggers: healed): If the bearer is healed, they're Horrified for 2 turns.

### `withstand.evil` — Wretched Bulwark
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 20 Shield for 1 turn. Each Unhallowed or Horrified enemy takes 10 Affliction damage, and the Shield gains 10 for each of them.
- applies: shield · ops: set, damage, apply

### `taunt.evil` — Tyrant's Gaze
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 2 turns. While they're Taunted, the user is Immortal.
- applies: taunt, immortal · ops: apply

### `titan.evil` — Lord of Souls
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Lifesteal and 1 Armor per Soul Fragment they have (max 4), but can't spend Soul Fragments.
- applies: lifesteal, armor · inline statuses: lord_of_souls · ops: apply
  - inline `lord_of_souls` (Neutral): The bearer can't spend Soul Fragments.

### `fiend_rend_soul` — Rend Soul (minion skill of `fiend`)
- Minion · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 Affliction damage to target enemy and makes them Unhallowed for 1 turn.
- applies: unhallowed · ops: damage, apply

### `fiend_feast` — Feast (minion skill of `fiend`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Drains a Soul Fragment from a Horrified enemy for the Fiend's summoner.
- applies: soul_fragment · ops: if, removeStacks, apply

### `tormentor_barbed_whip` — Barbed Whip (minion skill of `tormentor`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to target enemy.
- ops: damage

### `tormentor_false_mercy` — False Mercy (minion skill of `tormentor`)
- Minion · cost I · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Target enemy is Unhallowed for 1 turn; if it's applied, they then heal 15.
- applies: unhallowed · ops: apply, if, heal

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `fiend` — Fiend, 35 HP; skills: fiend_rend_soul, fiend_feast
- `tormentor` — Tormentor, 25 HP; skills: tormentor_barbed_whip, tormentor_false_mercy

## Named statuses defined here (1) — this group owns their default animations

- `unhallowed` — Unhallowed (Debuff): Any healing the bearer would receive, including Renew and Lifesteal, deals that much Affliction damage to them instead. _Applied by skills in: evil._

## Macros defined here (2) — this group owns their default animations

- `drain_it`: ops if, removeStacks, apply; applies soul_fragment. _Used by: curse, evil._
- `tithe`: ops set, repeat, removeStacks. _Used by: evil._
