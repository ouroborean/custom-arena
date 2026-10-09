# Reanimation — animation brief

Group id: `reanimation`. Element(s): Lightning + Unholy. Concept file: `docs/animations/concepts/reanimation.yaml`.
Skill source: `packages/content/data/fusions/reanimation/skills.reanimation.yaml`; minions: `packages/content/data/fusions/reanimation/minions.reanimation.yaml`; statuses: `packages/content/data/fusions/reanimation/statuses.reanimation.yaml`; macros: `packages/content/data/fusions/reanimation/macros.reanimation.yaml`.

## Skills (32)

### `strike.reanimation` — Deadhand
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. A Reanimated user deals 10 more and skips their next 5 HP loss.
- applies: deadhand_reprieve · ops: if, damage, apply

### `smash.reanimation` — Death Current
- Smash · cost SI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy and 15 to their allies; if it kills any of them, the user is Galvanized for 2 turns.
- applies: galvanized · ops: set, damage, if, apply

### `charge.reanimation` — Spark of Life
- Charge · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy; the user loses 10 HP and gains 3 Charge.
- applies: charged · ops: damage, apply

### `riposte.reanimation` — Dead Man's Switch
- Riposte · cost S · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the next Harmful skill used on the user; if the user is Galvanized, it's spent to Reflect the skill instead. Invisible.
- inline statuses: dead_mans_switch_reflect, dead_mans_switch · ops: if, apply, removeEffect
  - inline `dead_mans_switch_reflect` (Buff, hidden; triggers: skillTargeted/reflect): Reflects the next Harmful skill used on the bearer, spending their Galvanized.
  - inline `dead_mans_switch` (Buff, hidden; triggers: skillTargeted/counter): Counters the next Harmful skill used on the bearer.

### `rage.reanimation` — Galvanic Overdrive
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user is Galvanized, and at the start of each of their turns, they lose 10 HP and gain 2 Might for 1 turn and 1 Charge.
- applies: galvanized, might, charged · inline statuses: galvanic_overdrive · ops: apply, damage
  - inline `galvanic_overdrive` (Buff; triggers: turnStart): At the start of each of the bearer's turns, they lose 10 HP and gain 2 Might for 1 turn and 1 Charge.

### `shot.reanimation` — Bone Zap
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Marked for 1 turn; when the Mark is spent, the user drains a Soul Fragment from them.
- applies: mark, soul_fragment · inline statuses: bone_zap · ops: damage, apply, removeStacks
  - inline `bone_zap` (Neutral; triggers: ownEffectEnded): When the Mark is spent, the bearer drains a Soul Fragment from its bearer.

### `snipe.reanimation` — Dying Current
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- Until it lands, the user is Immortal. On the following turn, deals 30 damage to target enemy, plus half the HP the user is missing. The target of this skill is invisible. Channeled.
- applies: immortal · inline statuses: dying_current · ops: apply, damage
  - inline `dying_current` (Neutral): At the end of the following turn, deals 30 damage to its target, plus half the HP the bearer is missing.

### `trap.reanimation` — Death Coil
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy uses a Harmful skill, they take 15 damage, and for 2 turns they can't be healed and lose 5 HP each turn. Invisible.
- inline statuses: death_coil, death_coiled · ops: apply, damage
  - inline `death_coil` (Debuff, hidden; triggers: skillUsed): The first time the bearer uses a Harmful skill, they take 15 damage, and for 2 turns they can't be healed and lose 5 HP each turn.
  - inline `death_coiled` (Debuff; triggers: turnEnd): Can't be healed, and loses 5 HP each turn.

### `maneuver.reanimation` — Galvanic Twitch
- Maneuver · cost I · cooldown 2 · target **self** · tags Helpful, Strategic, UsableWhileStunned
- The user becomes Invulnerable for 1 turn, and any Stun on them jumps to a random enemy for the turns it had left. Usable while Stunned.
- applies: invulnerable · ops: apply, moveEffects

### `companion.reanimation` — Flesh Golem
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Flesh Golem (40 HP) permanently; the first time it dies, it returns with 20 HP, Reanimated. Slam (S): 15 damage, and Saps.
- summons: flesh_golem · ops: summon

### `bolt.reanimation` — Necrobolt
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who is Marked for 1 turn. A Reanimated user deals 10 more for each turn they've been back, up to 30.
- applies: mark · ops: damage, apply

### `blast.reanimation` — Soul Surge
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies, +10 for each Galvanized or Reanimated unit on the user's team.
- ops: damage

### `consume.reanimation` — Life Siphon
- Consume · cost I · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and the user heals 10, +10 if the target is Horrified. A Reanimated user gains the healing as Shield instead.
- applies: shield · ops: damage, set, if, apply, heal

### `summon.reanimation` — Patchwork Revenant
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Patchwork Revenant (25 HP) for 3 turns. Gnash (r): 10 Affliction damage.
- summons: patchwork_revenant · ops: summon

### `channel.reanimation` — Life Current
- Channel · cost r · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, 10 damage to all enemies at the end of each of the user's turns. The user is Galvanized while channeling. Channeled.
- applies: galvanized · inline statuses: life_current · ops: apply, damage
  - inline `life_current` (Neutral; triggers: turnEnd): Each turn, 10 damage to all enemies; the bearer is Galvanized meanwhile.

### `stab.reanimation` — Autopsy Blade
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, or 20 if they're at or below 60 HP. If the user is at or below 40 HP, it also drains a Soul Fragment from them.
- applies: soul_fragment · ops: damage, if, removeStacks, apply

### `ravage.reanimation` — Electrocution
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 Piercing damage to target enemy. If the user is Reanimated, it executes a target it leaves at or below 25 HP.
- ops: damage, if, kill

### `mislead.reanimation` — Lazarus Trick
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and each ally it targeted is Galvanized for 2 turns. Invisible.
- applies: galvanized · inline statuses: lazarus_trick · ops: apply
  - inline `lazarus_trick` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and its targets are Galvanized.

### `stun.reanimation` — Nerve Shock
- Stun · cost AI · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Stuns them for 1 turn. While they're Stunned, each Sapped they gain counts twice.
- applies: stun, sapped · inline statuses: nerve_shock · ops: damage, apply, if, setFlag
  - inline `nerve_shock` (Debuff; triggers: effectGained): While Stunned, each Sapped the bearer gains counts twice.

### `dance.reanimation` — Twitching Dance
- Dance · cost SA · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, 2 Swiftness and Lifesteal; each hit they deal while at full HP or Reanimated (when the Lifesteal can't heal) gives 1 Charge.
- applies: might, swiftness, lifesteal, charged · inline statuses: twitching_dance · ops: apply, if
  - inline `twitching_dance` (Buff; triggers: dealtDamage): Hits the Lifesteal can't heal give 1 Charge.

### `heal.reanimation` — Clear!
- Heal · cost S · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20 and gains 1 Charge; if that brings them to 3 Charge, they're also Galvanized for 2 turns.
- applies: charged, galvanized · ops: heal, apply, if

### `bless.reanimation` — Jolt of Life
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally is Galvanized for 3 turns.
- applies: galvanized · ops: apply

### `curse.reanimation` — Short Circuit
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- For 2 turns, each Buff target enemy would gain is lost, and they gain 1 Sapped instead.
- applies: sapped · inline statuses: short_circuit · ops: apply, eventEffect
  - inline `short_circuit` (Debuff; triggers: effectGained): Each Buff the bearer would gain is lost, and they gain 1 Sapped instead.

### `smite.reanimation` — Soul Spark
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, allies who damage them gain 10 Shield, or 20 if they're Reanimated.
- applies: shield · inline statuses: soul_spark · ops: damage, apply
  - inline `soul_spark` (Debuff; triggers: damaged): The applier's allies who damage the bearer gain Shield.

### `prayer.reanimation` — Raise the Fallen
- Prayer · cost Wrr · cooldown 4 · target **allAllies** · tags Helpful, Strategic
- Every dead ally returns with 30 HP, Reanimated; living allies heal 15.
- applies: reanimated · ops: heal, revive, forEach, apply, setCounter

### `cleave.reanimation` — Chain of Souls
- Cleave · cost I · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and to a random other enemy; if it kills one, it jumps to another random enemy for 20.
- ops: set, damage, if

### `shout.reanimation` — Wail of Lightning
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns. Meanwhile, whenever a unit on either side dies, the user's Charge fills to 3.
- applies: intimidated, charged · inline statuses: wail_of_lightning · ops: apply
  - inline `wail_of_lightning` (Buff; triggers: signal): Each death fills the bearer's Charge to 3.

### `withstand.reanimation` — Ribcage
- Withstand · cost S · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn; if it breaks, they're Galvanized for 2 turns.
- applies: galvanized · inline statuses: ribcage, ribcage_watch · ops: apply
  - inline `ribcage` (Buff): A Shield; if it breaks, the bearer is Galvanized.
  - inline `ribcage_watch` (Neutral; triggers: ownEffectEnded): If the Ribcage breaks, the bearer is Galvanized for 2 turns.

### `taunt.reanimation` — Lure the Living
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for 2 turns. If the user falls meanwhile, the enemy is Horrified for 2 turns.
- applies: taunt, horrified · inline statuses: lure_the_living · ops: apply, if
  - inline `lure_the_living` (Debuff; triggers: signal): If the applier falls, the bearer is Horrified.

### `titan.reanimation` — The Monster Lives
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Armor, Immune and Galvanized. If they return during it, they're Stormborn and gain 1 Might for the rest of the match.
- applies: armor, immune, galvanized · inline statuses: the_monster_lives · ops: apply
  - inline `the_monster_lives` (Buff): If the bearer returns from death, they're Stormborn and gain 1 Might for the rest of the match.

### `flesh_golem_slam` — Slam (minion skill of `flesh_golem`)
- Minion · cost S · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and Saps them.
- applies: sapped · ops: damage, apply

### `patchwork_revenant_gnash` — Gnash (minion skill of `patchwork_revenant`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `flesh_golem` — Flesh Golem, 40 HP; skills: flesh_golem_slam
  - passive `flesh_golem_stitches` (triggers: damaged): The first time it dies, it returns with 20 HP, Reanimated.
- `patchwork_revenant` — Patchwork Revenant, 25 HP; skills: patchwork_revenant_gnash

## Named statuses defined here (4) — this group owns their default animations

- `galvanized` — Galvanized (Buff; triggers: damaged): If the bearer dies while Galvanized, they return at the end of that turn with 30 HP, Reanimated. Each character can be Reanimated once per match. _Applied by skills in: reanimation._
- `reanimating` — Reanimating (Neutral): Returns at the end of this turn, Reanimated. _Applied by skills in: none directly._
- `reanimated` — Reanimated (Neutral; triggers: turnEnd): Can't be healed or gain Renew, and loses 5 HP at the end of each of their turns. _Applied by skills in: reanimation._
- `deadhand_reprieve` — Reprieve (Buff): The next 5 HP loss from Reanimated is skipped. _Applied by skills in: reanimation._

## Macros defined here (1) — this group owns their default animations

- `reanimate`: ops heal, apply, setCounter, if; applies reanimated, stormborn, might. _Used by: none directly._
