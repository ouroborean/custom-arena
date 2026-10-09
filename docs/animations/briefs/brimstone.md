# Brimstone — animation brief

Group id: `brimstone`. Element(s): Fire + Poison. Concept file: `docs/animations/concepts/brimstone.yaml`.
Skill source: `packages/content/data/fusions/brimstone/skills.brimstone.yaml`; minions: `packages/content/data/fusions/brimstone/minions.brimstone.yaml`; statuses: `packages/content/data/fusions/brimstone/statuses.brimstone.yaml`; macros: `packages/content/data/fusions/brimstone/macros.brimstone.yaml`.

## Skills (30)

### `strike.brimstone` — Fuming Blow
- Strike · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who gains 1 Sulfur. If that brings them to 4, their Sulfur Erupts at once.
- applies: sulfur · macros: erupt · ops: damage, apply, if, forEach, macro

### `smash.brimstone` — Brimquake
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies. For 2 turns, Explosions deal 10 more to each enemy it hit.
- inline statuses: brimquake · ops: damage, apply
  - inline `brimquake` (Debuff; triggers: signal): Each Explosion from the bearer's enemies deals them 10 more.

### `charge.brimstone` — Choking Lunge
- Charge · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and the user gets 1 Focus for their next skill. Until the user's next turn, Toxin on the target also ticks at the start of the target's turn.
- applies: focus · inline statuses: choking_lunge · ops: damage, apply
  - inline `choking_lunge` (Debuff; triggers: turnStart): The bearer's Toxin also ticks at the start of their turn.

### `riposte.brimstone` — Brimstone Hide
- Riposte · cost W · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user. Its user gains 2 Sulfur; if they're Ignited, it Erupts at once and the user heals as much as it deals them. Invisible.
- applies: sulfur · inline statuses: brimstone_hide · macros: erupt · ops: apply, if, forEach, macro, heal
  - inline `brimstone_hide` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; their users gain Sulfur, Erupting if Ignited.

### `rage.brimstone` — Scent of Cinders
- Rage · cost S · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might and Immune, and every Ignited or Scorched enemy counts as Prey.
- applies: might, immune · inline statuses: cinder_scent · ops: apply
  - inline `cinder_scent` (Debuff): While Ignited or Scorched, the bearer counts as Prey.

### `shot.brimstone` — Sulfur Sting
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 Piercing damage to target enemy, who gains 1 Sulfur. If they're Prey or already had Sulfur, it all Erupts.
- applies: sulfur · macros: erupt · ops: set, damage, apply, if, forEach, macro

### `snipe.brimstone` — Pitch Javelin
- Snipe · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget, Uncounterable
- On the following turn, target enemy gains 2 Sulfur, then their Sulfur Erupts. The target of this skill is invisible. Channeled, Uncounterable.
- applies: sulfur · inline statuses: pitch_javelin · macros: erupt · ops: apply, forEach, macro
  - inline `pitch_javelin` (Neutral): At the end of the following turn, unless interrupted, its target gains 2 Sulfur, then their Sulfur Erupts.

### `trap.brimstone` — Brimstone Pit
- Trap · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a Helpful skill, every unit it targets gains 2 Sulfur, and it all Erupts. Invisible.
- applies: sulfur · inline statuses: brimstone_pit · macros: erupt · ops: apply, forEach, macro
  - inline `brimstone_pit` (Debuff, hidden; triggers: skillUsed): The bearer's first Helpful skill gives each of its targets 2 Sulfur and makes it Erupt.

### `maneuver.brimstone` — Choking Pall
- Maneuver · cost S · cooldown 2 · target **self** · tags Helpful, Strategic, Unstunnable
- The user becomes Invulnerable for 1 turn, and every other unit, ally or enemy, is Blinded for 1 turn. Unstunnable.
- applies: invulnerable, blinded · ops: apply

### `companion.brimstone` — Belching Toad
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Belching Toad (30 HP) permanently. At the end of each of your turns, it moves a Debuff from a random ally onto a random enemy.
- summons: belching_toad · ops: summon

### `bolt.brimstone` — Acrid Orb
- Bolt · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and Marks them for 1 turn. Until the Mark is spent, they count as Prey.
- applies: mark · inline statuses: acrid_orb · ops: damage, apply
  - inline `acrid_orb` (Debuff): While Marked, the bearer counts as Prey.

### `blast.brimstone` — Burning Downpour
- Blast · cost Wr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies. Then each one's Ignite ticks once for every 2 Toxin they have (max 3).
- macros: ignite_tick · ops: damage, forEach, repeat, macro

### `consume.brimstone` — Consumed by Fire
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Ignites target enemy for 2 turns. This Ignite deals 10 instead of 5, and the user heals as much each time it deals damage.
- inline statuses: consumed_by_fire · macros: burn_aftermath · ops: apply, damage, heal, macro
  - inline `consumed_by_fire` (Debuff; triggers: turnEnd): An Ignite that burns for 10 Affliction at the end of the applier's turn and heals the applier as much.

### `summon.brimstone` — Stokers
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons 2 Stokers (10 HP) for 2 turns. At the end of each of your turns, each Ignites an enemy with Sulfur; if no enemy has any, it gives a random one 1 Sulfur instead.
- summons: stoker · ops: summon

### `channel.brimstone` — Hellmouth
- Channel · cost Irr · cooldown 8 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 8 turns, at the end of each of the user's turns, deals 5 Affliction damage to all enemies, and a random enemy gains 1 Sulfur. When it ends or is broken, every enemy's Sulfur Erupts. Channeled.
- applies: sulfur · inline statuses: hellmouth, hellmouth_maw · macros: erupt · ops: apply, damage, removeSelf, forEach, macro
  - inline `hellmouth` (Neutral; triggers: turnEnd): Each turn, 5 Affliction to all enemies and 1 Sulfur to a random one. When it ends, all Sulfur Erupts.
  - inline `hellmouth_maw` (Neutral; triggers: ownEffectEnded): When the Hellmouth ends or is broken, every enemy's Sulfur Erupts.

### `stab.brimstone` — Strike the Match
- Stab · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy. If that leaves them at or below 40 HP, the user Explodes.
- macros: explode · ops: damage, if, macro

### `ravage.brimstone` — Caustic Flame
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 Affliction damage to target enemy, +10 per Toxin on them. Then their Toxin is removed.
- ops: damage, removeEffect

### `mislead.brimstone` — Choking Fumes
- Mislead · cost W · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered and they gain 1 Sulfur per energy it cost. Invisible.
- applies: sulfur · inline statuses: choking_fumes · ops: apply
  - inline `choking_fumes` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and they gain 1 Sulfur per energy it cost.

### `stun.brimstone` — Asphyxiate
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Bypass
- Deals 10 damage to target enemy, who is Stunned for 1 turn. Swiftness, Immune and Unstunnable don't stop it. Bypass.
- inline statuses: asphyxiated · ops: damage, apply
  - inline `asphyxiated` (Neutral): Stunned; Swiftness, Immune and Unstunnable can't stop it.

### `dance.brimstone` — Sulfur Dance
- Dance · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- For 3 turns, at the end of each of the user's turns, a random enemy gains 1 Sulfur and the user gains 1 Swiftness until this ends. When it ends, the user Explodes.
- applies: sulfur, swiftness · inline statuses: sulfur_dance · macros: explode · ops: apply, macro
  - inline `sulfur_dance` (Buff; triggers: turnEnd): Each turn, 1 Sulfur to a random enemy and 1 Swiftness; the user Explodes when it ends.

### `heal.brimstone` — Sulfur Tonic
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20, and their Toxin is removed; a random enemy gains that much Sulfur.
- applies: sulfur · ops: heal, set, removeEffect, apply

### `bless.brimstone` — Brimfire Crest
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 3 turns, target ally gains 1 Might and Flameborn, and their Flameborn heals them for all the Affliction damage they deal, not just their Ignites'.
- applies: might, flameborn · inline statuses: brimfire_crest · ops: apply, heal
  - inline `brimfire_crest` (Buff; triggers: dealtDamage): The bearer heals for all the indirect damage they deal.

### `curse.brimstone` — Sulfurous Miasma
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy's Toxin turns into Sulfur, stack for stack (max 4), and they're Confused for 2 turns.
- applies: sulfur, confusion · ops: set, removeEffect, apply

### `smite.brimstone` — Brand of Sulfur
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who gains 2 Sulfur. For 1 turn, allies who damage them heal 5 per Sulfur on them.
- applies: sulfur · inline statuses: brand_of_sulfur · ops: damage, apply, heal
  - inline `brand_of_sulfur` (Debuff; triggers: damaged): The applier's allies who damage the bearer heal 5 per Sulfur on them.

### `prayer.brimstone` — Hellsong
- Prayer · cost Sr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 15 and gain Flameborn for 2 turns, which also heals them 10 for each Eruption their side causes.
- applies: flameborn · inline statuses: hellsong · ops: heal, apply
  - inline `hellsong` (Buff; triggers: signal): Heals 10 for each Eruption the bearer's side causes.

### `cleave.brimstone` — Burning Tail
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to a random other enemy, who gains as much Sulfur as the target has.
- applies: sulfur · ops: damage, forEach, apply

### `shout.brimstone` — Stench of Sulfur
- Shout · cost r · cooldown 1 · target **allEnemies** · tags Harmful, Strategic
- All enemies gain 1 Sulfur. For 2 turns, whenever Sulfur the user gave is cleansed away, its bearer takes 10 Affliction damage instead.
- applies: sulfur · inline statuses: stench_of_sulfur · ops: apply, damage
  - inline `stench_of_sulfur` (Buff; triggers: ownEffectEnded): When Sulfur the bearer gave is cleansed away, the unit it was on takes 10 Affliction damage.

### `withstand.brimstone` — Cinder Mantle
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. If an enemy breaks it, the user becomes Flameborn for 2 turns.
- applies: flameborn · inline statuses: cinder_mantle, cinder_mantle_watch · ops: apply
  - inline `cinder_mantle` (Buff): A Shield; if it's broken, the bearer becomes Flameborn.
  - inline `cinder_mantle_watch` (Buff; triggers: ownEffectEnded): If the Cinder Mantle is broken, the bearer becomes Flameborn for 2 turns.

### `taunt.brimstone` — Lure of the Pit
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. Whenever another enemy uses a Helpful skill meanwhile, the Taunt jumps to them.
- applies: taunt · inline statuses: lure_of_the_pit · ops: apply, removeEffect
  - inline `lure_of_the_pit` (Debuff; triggers: skillUsed): If the bearer uses a Helpful skill, the applier's Taunt jumps to them.

### `titan.brimstone` — Pit Lord
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune, and each enemy who deals them direct damage gains 1 Sulfur and is Ignited.
- applies: immune, sulfur, ignite · inline statuses: pit_lord · ops: apply
  - inline `pit_lord` (Buff; triggers: damaged): Each enemy who deals the bearer direct damage gains 1 Sulfur and is Ignited.

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `belching_toad` — Belching Toad, 30 HP; skills: none
  - passive `belching_toad_gulp` (triggers: turnEnd): At the end of its owner's turn, moves a Debuff from a random ally onto a random enemy.
- `stoker` — Stoker, 10 HP; skills: none
  - passive `stoker_flame` (triggers: turnEnd): At the end of its owner's turn, Ignites an enemy with Sulfur; if none has any, gives a random enemy 1 Sulfur instead.

## Named statuses defined here (1) — this group owns their default animations

- `sulfur` — Sulfur (Debuff): Max 4. Does nothing on its own. When the bearer takes Ignite damage or is hit by an Explosion, it Erupts: 10 Affliction per stack to them and 5 per stack to each of their allies, and every stack turns into 1 Toxin. _Applied by skills in: brimstone._

## Macros defined here (2) — this group owns their default animations

- `erupt`: ops set, if, removeEffect, damage, apply, signal; applies toxin. _Used by: brimstone._
- `ignite_tick`: ops if, damage, macro. _Used by: brimstone, devil, phoenix, ritual._
