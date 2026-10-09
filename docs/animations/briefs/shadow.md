# Shadow — animation brief

Group id: `shadow`. Element(s): Shadow. Concept file: `docs/animations/concepts/shadow.yaml`.
Skill source: `packages/content/data/shadow/skills.shadow.yaml`; minions: `packages/content/data/shadow/minions.shadow.yaml`; statuses: `packages/content/data/shadow/statuses.shadow.yaml`; macros: `packages/content/data/shadow/macros.shadow.yaml`.

## Skills (33)

### `strike.shadow` — Black Axe
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If this kills the target, the user gains Stealth.
- macros: gain_stealth · ops: damage, if, forEach, macro

### `smash.shadow` — Shadow Crash
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and 10 to the other enemies, then the user gains Stealth.
- macros: gain_stealth · ops: damage, forEach, macro

### `charge.shadow` — Long Shadow
- Charge · cost S · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 10 damage to target enemy. Stealthy. The user's next skill is also Stealthy.
- inline statuses: long_shadow · ops: damage, apply
  - inline `long_shadow` (Buff): The bearer's next skill is Stealthy.

### `riposte.shadow` — Mirage Blade
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, the user counters the first Harmful skill used on them and gains 1 Focus. Invisible.
- applies: focus · inline statuses: mirage_blade · ops: apply
  - inline `mirage_blade` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer, who then gains 1 Focus.

### `rage.shadow` — Night of Knives
- Rage · cost SA · cooldown 4 · target **self** · tags Helpful, Strategic, Stealthy
- For 3 turns, the user gains 1 Might and 1 Swiftness. Stealthy.
- applies: might, swiftness · ops: apply

### `shot.shadow` — Shadow Spine
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 Piercing damage to target enemy and Isolates them for 1 turn.
- applies: isolated · ops: damage, apply

### `snipe.shadow` — Dream Seeker
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- The user deals 35 damage to target enemy on the following turn, Bypassing Invulnerability. It doesn't end Sleep.
- inline statuses: dream_seeker · ops: apply, damage
  - inline `dream_seeker` (Neutral): At the end of the following turn, 35 damage to the target, Bypassing Invulnerability.

### `trap.shadow` — Dream Chains
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 1 turn, if target enemy doesn't use a skill, they take 15 Affliction damage and fall Asleep.
- applies: sleep · inline statuses: dream_chains · ops: apply, setFlag, if, damage
  - inline `dream_chains` (Debuff; triggers: skillUsed): If the bearer uses no skill before this ends, they take 15 Affliction damage and fall Asleep.

### `maneuver.shadow` — Shadowstep
- Maneuver · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Stealthy
- The user becomes Ghosted for 1 turn. Stealthy.
- applies: ghosted · ops: apply

### `companion.shadow` — Spirit Raven
- Companion · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Spirit Raven minion (30 HP). Fel Swoop (r): 10 Piercing damage to target enemy and heals the Raven 10. Blackwing (r): Taunts target enemy for 1 turn.
- summons: spirit_raven · ops: summon

### `bolt.shadow` — Blackbolt
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Blinds them for 2 turns.
- applies: blinded · ops: damage, apply

### `blast.shadow` — Wave of Darkness
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies and gives each 1 Confusion for 1 turn.
- applies: confusion · ops: damage, apply

### `consume.shadow` — Drink Darkness
- Consume · cost r · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 5 Affliction damage to all enemies. Blinded ones lose their Blind and take 10 more damage; if none were Blinded, a random enemy is Blinded for 2 turns.
- applies: blinded · ops: damage, set, forEach, removeEffect, if, apply

### `summon.shadow` — Call Shade
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Shade minion (15 HP) for 3 turns. Shadow Choke (r): target enemy takes 5 Affliction damage and is Blinded for 1 turn.
- summons: shade · ops: summon

### `channel.shadow` — Nightsong
- Channel · cost Ar · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- Deals 10 damage to all enemies for 3 turns. If the channel completes, every enemy falls Asleep. Channeled.
- applies: sleep · inline statuses: nightsong · ops: apply, damage
  - inline `nightsong` (Neutral; triggers: turnEnd): Each end of the user's turn, 10 damage to all enemies. If it runs its full course, all enemies fall Asleep.

### `stab.shadow` — Backstab
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, increased to 20 unless they were the last enemy to damage the user.
- ops: set, if, signal, damage

### `ravage.shadow` — Ambush
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Piercing damage to target enemy, doubled if the user is Stealthed.
- ops: damage

### `mislead.shadow` — Illusory Lure
- Mislead · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 1 turn, if target enemy uses a Harmful skill, it is countered and they are Isolated for 2 turns.
- applies: isolated · inline statuses: illusory_lure · ops: apply
  - inline `illusory_lure` (Debuff; triggers: skillUsed/counter): The bearer's Harmful skills are countered, and each counter Isolates them for 2 turns.

### `stun.shadow` — Sap
- Stun · cost A · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and puts them to Sleep.
- applies: sleep · ops: damage, apply

### `dance.shadow` — Hall of Phantoms
- Dance · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- The user gains Stealth. If they were already Stealthed, they also gain Ghosted, Immune and 1 Focus for 2 turns.
- applies: ghosted, immune, focus · macros: gain_stealth · ops: set, forEach, macro, if, apply

### `heal.shadow` — Touch of Slumber
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20 HP and falls Asleep.
- applies: sleep · ops: heal, apply

### `bless.shadow` — Nightwrap
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally gains Stealth.
- macros: gain_stealth · ops: forEach, macro

### `curse.shadow` — Blinding Powder
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Blinded for 3 turns.
- applies: blinded · ops: apply

### `smite.shadow` — Shadowbrand
- Smite · cost A · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and Sanctifies them for 2 turns. Used from Stealth, it has no cooldown.
- applies: sanctify · ops: damage, apply, if, resetCooldown

### `prayer.shadow` — Nightfall
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies gain Stealth and heal 20 HP.
- macros: gain_stealth · ops: heal, forEach, macro

### `cleave.shadow` — Shadow Pulse
- Cleave · cost S · cooldown 1 · target **allEnemies** · tags Harmful, NonStrategic, Stealthy
- Deals 10 damage to all enemies. Stealthy.
- ops: damage

### `shout.shadow` — Hunter's Howl
- Shout · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- Blinds all enemies for 2 turns. Enemies already Blinded are Intimidated for 2 turns instead.
- applies: intimidated, blinded · ops: forEach, if, apply

### `withstand.shadow` — Veiled Guard
- Withstand · cost A · cooldown 1 · target **self** · tags Helpful, Strategic
- The user gains 1 permanent Armor. Then, if they have 3 or more Armor, they gain Stealth.
- applies: armor · macros: gain_stealth · ops: apply, if, forEach, macro

### `taunt.shadow` — Shadow Mockery
- Taunt · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Creates a Shadow Mockery minion (5 HP). Target enemy is Taunted by it for 1 turn.
- applies: taunt · summons: shadow_mockery · ops: summon, apply

### `titan.shadow` — Faceless One
- Titan · cost AW · cooldown 4 · target **allEnemies** · tags Harmful, Strategic
- For 3 turns, the user gains 1 Armor, and all enemies are Taunted by the user and Isolated.
- applies: armor, taunt, isolated · ops: apply

### `raven_fel_swoop` — Fel Swoop (minion skill of `spirit_raven`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Piercing damage to target enemy and heals the Spirit Raven 10 HP.
- ops: damage, heal

### `raven_blackwing` — Blackwing (minion skill of `spirit_raven`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic
- Taunts target enemy for 1 turn.
- applies: taunt · ops: apply

### `shade_shadow_choke` — Shadow Choke (minion skill of `shade`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Target enemy takes 5 Affliction damage and is Blinded for 1 turn.
- applies: blinded · ops: damage, apply

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `spirit_raven` — Spirit Raven, 30 HP; skills: raven_fel_swoop, raven_blackwing
- `shade` — Shade, 15 HP; skills: shade_shadow_choke
- `shadow_mockery` — Shadow Mockery, 5 HP; skills: none

## Named statuses defined here (2) — this group owns their default animations

- `stealth` — Stealth (Buff): Untargetable by enemies. Skills give it for 2 turns. Ends after the bearer uses a skill that isn't Stealthy; a Stealthy skill extends it by 1 turn instead. _Applied by skills in: assassin, mirror, moon, night, ninja, ritual, vigilante._
- `blinded` — Blinded (Debuff): The primary target of the bearer's single-target skills is chosen at random. _Applied by skills in: brimstone, curse, dimension, mirror, moon, ritual, spore, sun, shadow._

## Macros defined here (1) — this group owns their default animations

- `gain_stealth`: ops removeEffect, apply; applies stealth. _Used by: dimension, shadow._
