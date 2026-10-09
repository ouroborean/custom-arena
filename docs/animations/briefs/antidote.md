# Antidote — animation brief

Group id: `antidote`. Element(s): Poison + Holy. Concept file: `docs/animations/concepts/antidote.yaml`.
Skill source: `packages/content/data/fusions/antidote/skills.antidote.yaml`; minions: `packages/content/data/fusions/antidote/minions.antidote.yaml`; statuses: `packages/content/data/fusions/antidote/statuses.antidote.yaml`; macros: `packages/content/data/fusions/antidote/macros.antidote.yaml`.

## Skills (33)

### `strike.antidote` — Cleansing Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy; the user Purges one of their own Debuffs onto the target.
- macros: purge_one_to_primary · ops: damage, forEach, macro

### `smash.antidote` — Shared Absolution
- Smash · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 10 to their allies. Until the user's next turn, Sanctify on any of them heals every ally of the damager, not only the damager.
- applies: shared_absolution · ops: damage, apply

### `charge.antidote` — Quickened Venom
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who gains 1 Toxin. Until the end of their next turn, their Toxin also ticks each time they use a skill.
- applies: toxin · inline statuses: quickened_venom · ops: damage, apply, if
  - inline `quickened_venom` (Debuff; triggers: skillUsed): The bearer's Toxin ticks each time they use a skill.

### `riposte.antidote` — Acquired Tolerance
- Riposte · cost W · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, who then becomes Inoculated. Invisible.
- applies: inoculated · inline statuses: acquired_tolerance · ops: apply
  - inline `acquired_tolerance` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, who then becomes Inoculated.

### `rage.antidote` — Immune Response
- Rage · cost A · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might and their Debuffs have no effect. When it ends, they Purge all of them onto random enemies.
- applies: might · inline statuses: immune_response · macros: purge_all_to_random · ops: apply, forEach, macro
  - inline `immune_response` (Buff): The bearer's Debuffs have no effect. When this ends, they're Purged onto random enemies.

### `shot.antidote` — Remedy Dart
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, and the user's most wounded ally is Inoculated.
- applies: inoculated · ops: damage, apply

### `snipe.antidote` — Long Diagnosis
- Snipe · cost Arr · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- In 3 turns, deals 20 damage to target enemy, plus 15 for each skill they used meanwhile (max 45 more). The target of this skill is invisible. Channeled.
- inline statuses: diagnosis_chart, long_diagnosis · ops: apply, addStacksSelf, set, removeEffect, damage
  - inline `diagnosis_chart` (Neutral, hidden; triggers: skillUsed): Counts the skills the bearer uses.
  - inline `long_diagnosis` (Neutral): When this runs out, its target takes 20 damage plus 15 per skill they used meanwhile (max 45 more).

### `trap.antidote` — Countervenom
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy gives one of the user's allies a Debuff, it's Purged at once, onto them. Invisible.
- inline statuses: countervenom · ops: apply, eventEffect, damage
  - inline `countervenom` (Debuff, hidden; triggers: effectApplied): The first Debuff the bearer gives an enemy is Purged at once, onto them.

### `maneuver.antidote` — Quarantine
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user becomes Invulnerable for 1 turn. Every enemy who uses a Harmful skill on them meanwhile counts as Prey for 2 turns.
- applies: invulnerable, prey · inline statuses: quarantine · ops: apply
  - inline `quarantine` (Buff; triggers: skillTargeted): Each enemy who uses a Harmful skill on the bearer counts as Prey for 2 turns.

### `companion.antidote` — Asclepian Serpent
- Companion · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- Summons an Asclepian Serpent (40 HP) permanently. Cure (W): Purges one Debuff from target ally. Serpent's Kiss (r): 5 Piercing damage and 1 Toxin.
- summons: asclepian_serpent · ops: summon

### `bolt.antidote` — Neutralize
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 2 turns, the next Buff they would gain is stopped, and they can't gain that Buff again for 3 turns.
- inline statuses: neutralized · ops: damage, apply, immunize, eventEffect
  - inline `neutralized` (Debuff; triggers: effectGained): The next Buff the bearer would gain is stopped, and they're immune to it for 3 turns.

### `blast.antidote` — Holy Wash
- Blast · cost IW · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies. Then each ally Purges 1 Debuff, and each Purge hits every enemy.
- ops: damage, forEach, set, removeRandom, if

### `consume.antidote` — Draw the Venom
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it; a random ally with Toxin Purges all of it onto them.
- ops: damage, heal, forEach, set, removeEffect

### `summon.antidote` — Apothecary
- Summon · cost A · cooldown 2 · target **self** · tags Helpful, Strategic
- Summons an Apothecary (15 HP) for 3 turns. Milk Venom (r): 10 damage to target enemy; if they have Toxin, a random ally is Inoculated.
- summons: apothecary · ops: summon

### `channel.antidote` — Long Treatment
- Channel · cost rr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies, and a random ally with Debuffs loses 1 and is Inoculated. Channeled.
- applies: inoculated · inline statuses: long_treatment · ops: apply, damage, forEach, removeRandom
  - inline `long_treatment` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies, and an ally with Debuffs loses 1 and is Inoculated.

### `stab.antidote` — Find the Wound
- Stab · cost A · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 at or below 60 HP. For 2 turns, being at or below 60 HP makes them Prey.
- applies: find_the_wound · ops: damage, apply

### `ravage.antidote` — Tempered Blade
- Ravage · cost Wr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy. If the user is Inoculated, they spend it for 15 more damage; if not, they become Inoculated.
- applies: inoculated · ops: if, removeEffect, damage, apply

### `mislead.antidote` — False Symptom
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and each of its targets Purges 1 Debuff onto them. Invisible.
- inline statuses: false_symptom · ops: apply, forEach, set, removeRandom, if, damage
  - inline `false_symptom` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and each of its targets Purges 1 Debuff onto them.

### `stun.antidote` — Twilight Sleep
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy and the user fall Asleep for 2 turns. Neither can take damage meanwhile, so nothing wakes them early.
- applies: sleep, invulnerable · ops: apply

### `dance.antidote` — Clean Bill of Health
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, 2 Swiftness and 1 Focus. At the end of each of their turns, if they have no Debuffs, their cooldowns drop by 1.
- applies: might, swiftness, focus · inline statuses: clean_bill · ops: apply, if, adjustCooldowns
  - inline `clean_bill` (Buff; triggers: turnEnd): At the end of each of the bearer's turns, with no Debuffs, their cooldowns drop by 1.

### `heal.antidote` — Antivenom
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 25 and is Inoculated. If that stops a Debuff, its source takes 10 Affliction.
- applies: antivenom, inoculated · ops: heal, apply

### `bless.antidote` — Vaccinate
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Toxin. For 3 turns, they're immune to further Toxin and gain 1 Might and 1 Renew.
- applies: toxin, might, renew · ops: apply, immunize

### `curse.antidote` — Crisis of Conscience
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns and Condemned. For 2 turns, their Condemned returns after it resolves, so every skill they use costs them another random Debuff.
- applies: confusion, condemned · inline statuses: crisis_of_conscience · ops: apply
  - inline `crisis_of_conscience` (Debuff; triggers: skillUsed): Each skill the bearer uses Condemns them again.

### `smite.antidote` — Theriac Brand
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. For 1 turn, each ally of the user who damages them Purges one of their own Debuffs onto them, or becomes Inoculated if they have none.
- applies: inoculated · inline statuses: theriac_brand · ops: damage, apply, forEach, if, set, removeRandom
  - inline `theriac_brand` (Debuff; triggers: damaged): Each ally of the applier who damages the bearer Purges one of their Debuffs onto them, or is Inoculated if they have none.

### `prayer.antidote` — Healing Liturgy
- Prayer · cost AW · cooldown 3 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20 and gain 10 Shield. For 2 turns, when an enemy gives one of them a Debuff, every ally becomes immune to it for 3 turns.
- applies: shield · inline statuses: healing_liturgy · ops: heal, apply, if, immunize
  - inline `healing_liturgy` (Buff; triggers: effectGained): When an enemy gives the bearer a Debuff, every ally becomes immune to it for 3 turns.

### `cleave.antidote` — Twin Fangs
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 10 to a random other enemy. If one of them is Condemned, the other is marked as Prey for 2 turns.
- applies: prey · ops: damage, forEach, if, apply

### `shout.antidote` — Sterilize
- Shout · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- Every ally loses 1 Debuff. All enemies are Intimidated for 2 turns, with 1 stack per Debuff stack removed (at least 1).
- applies: intimidated · ops: set, forEach, removeRandom, apply

### `withstand.antidote` — Hardened Constitution
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user Purges all their Debuffs onto random enemies, then gains 20 Shield for 1 turn, +10 per Debuff Purged.
- applies: shield · macros: purge_all_to_random · ops: forEach, macro, apply

### `taunt.antidote` — Turn the Other Cheek
- Taunt · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted for 2 turns. Each time they hit the user meanwhile, the user is Anointed until the end of their next turn.
- applies: taunt, anointed · inline statuses: other_cheek · ops: apply, if
  - inline `other_cheek` (Debuff; triggers: dealtDamage): Each time the bearer hits the applier, the applier is Anointed.

### `titan.antidote` — Living Cure
- Titan · cost W · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor and becomes Inoculated at the start of each of their turns.
- applies: armor, inoculated · inline statuses: living_cure · ops: apply
  - inline `living_cure` (Buff; triggers: turnStart): The bearer becomes Inoculated at the start of each of their turns.

### `serpent_cure` — Cure (minion skill of `asclepian_serpent`)
- Minion · cost W · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally Purges one Debuff onto a random enemy.
- macros: purge_one_to_random · ops: forEach, macro

### `serpent_kiss` — Serpent's Kiss (minion skill of `asclepian_serpent`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, who gains 1 Toxin.
- applies: toxin · ops: damage, apply

### `apothecary_milk_venom` — Milk Venom (minion skill of `apothecary`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy; if they have Toxin, a random ally is Inoculated.
- applies: inoculated · ops: damage, if, apply

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `asclepian_serpent` — Asclepian Serpent, 40 HP; skills: serpent_cure, serpent_kiss
- `apothecary` — Apothecary, 15 HP; skills: apothecary_milk_venom

## Named statuses defined here (5) — this group owns their default animations

- `inoculated` — Inoculated (Buff; triggers: effectGained): The next Debuff applied to the bearer is prevented, and they're immune to that Debuff for 3 turns. _Applied by skills in: antidote._
- `immunity` — Immunity (Buff): The bearer can't gain the Debuff this immunity was made against. _Applied by skills in: none directly._
- `antivenom` — Antivenom (Neutral): When the bearer's Inoculation stops a Debuff, its source takes 10 Affliction. _Applied by skills in: antidote._
- `find_the_wound` — Found Wound (Debuff): While at or below 60 HP, the bearer counts as Prey. _Applied by skills in: antidote._
- `shared_absolution` — Shared Absolution (Debuff; triggers: damaged): While Sanctified, each direct hit on the bearer also heals every other ally of the damager 15. _Applied by skills in: antidote._

## Macros defined here (3) — this group owns their default animations

- `purge_one_to_primary`: ops set, removeRandom, if, damage. _Used by: antidote._
- `purge_one_to_random`: ops set, removeRandom, if, damage. _Used by: antidote._
- `purge_all_to_random`: ops set, removeKind, repeat, damage. _Used by: antidote._
