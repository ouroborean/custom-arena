# Ion — animation brief

Group id: `ion`. Element(s): Lightning + Shadow. Concept file: `docs/animations/concepts/ion.yaml`.
Skill source: `packages/content/data/fusions/ion/skills.ion.yaml`; minions: `packages/content/data/fusions/ion/minions.ion.yaml`; statuses: `packages/content/data/fusions/ion/statuses.ion.yaml`; macros: `packages/content/data/fusions/ion/macros.ion.yaml`.

## Skills (33)

### `strike.ion` — Power Cut
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. Until their next skill resolves, they can't apply Buffs; that skill's other effects still happen.
- applies: numb · ops: damage, apply

### `smash.ion` — Surge from the Dark
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Each ally gives all their Charge to the user. Then deals 20 damage to target enemy and 10 to their allies, +5 to each hit per Charge given.
- ops: set, moveEffects, damage

### `charge.ion` — Dark Current
- Charge · cost S · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Stealthy
- Deals 10 damage to target enemy, who has Blackout until the user's next turn; the user gains 1 Focus. Stealthy.
- applies: focus · macros: blackout · ops: damage, set, forEach, macro, apply

### `riposte.ion` — Null Guard
- Riposte · cost A · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user; its user is Suppressed for 1 turn per Buff they have, up to 3. Invisible.
- applies: suppressed · inline statuses: null_guard · ops: apply, if
  - inline `null_guard` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer and Suppresses its user.

### `rage.ion` — Static Fury
- Rage · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Might, and each enemy they damage is Suppressed until the user's next turn.
- applies: might, suppressed · inline statuses: static_fury · ops: apply
  - inline `static_fury` (Buff; triggers: dealtDamage): Enemies the bearer damages are Suppressed until their next turn.

### `shot.ion` — Seeker Spark
- Shot · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, or to the Stealthed enemies instead if there are any, ending their Stealth.
- ops: if, forEach, removeEffect, damage

### `snipe.ion` — Ion Cannon
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, target enemy is Suppressed for 1 turn and takes 40 damage. The target of this skill is invisible. Channeled.
- applies: suppressed · inline statuses: ion_cannon · ops: apply, damage
  - inline `ion_cannon` (Neutral): At the end of the following turn, its target is Suppressed for 1 turn and takes 40 damage.

### `trap.ion` — EMP Mine
- Trap · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 3 turns, the first time target enemy summons a minion or starts a channel, they take 15 damage and have Blackout for 3 turns. Invisible.
- inline statuses: emp_mine · macros: blackout · ops: apply, damage, set, forEach, macro
  - inline `emp_mine` (Debuff, hidden; triggers: skillResolved): The first time the bearer summons a minion or starts a channel, they take 15 damage and have Blackout for 3 turns.

### `maneuver.ion` — Go Dark
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic, Stealthy
- The user becomes Invulnerable for 2 turns, but can't use Harmful skills for as long. Stealthy.
- applies: invulnerable · inline statuses: go_dark · ops: apply
  - inline `go_dark` (Neutral): Can't use Harmful skills.

### `companion.ion` — Shadow Drone
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Shadow Drone (20 HP) permanently, Stealthed. Scramble (r, Stealthy): target enemy is Suppressed for 1 turn. Needle Arc (r): 15 Piercing damage to target enemy; it ends the Drone's Stealth.
- summons: shadow_drone · ops: summon

### `bolt.ion` — Blackspark
- Bolt · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, who has Blackout for 2 turns; 15 more if they're channeling or have a minion.
- macros: blackout · ops: damage, set, forEach, macro

### `blast.ion` — EMP
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies, and each is Suppressed for 1 turn, +1 per Charge the user spends on it (all of it).
- applies: suppressed · ops: damage, set, removeEffect, apply

### `consume.ion` — Grid Drain
- Consume · cost r · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy and 10 to each of their minions, which are blacked out for 1 turn; the user heals for all the damage dealt.
- applies: blacked_out · ops: damage, set, apply, heal

### `summon.ion` — Jammer
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Jammer (15 HP) for 3 turns; while it's alive, every enemy has Blackout. Static Hiss (r): 10 damage to target enemy.
- summons: jammer · ops: summon

### `channel.ion` — Dark Hum
- Channel · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, NonStrategic, Channeled, Stealthy
- For up to 3 turns, at the end of each of the user's turns, deals 10 damage to all enemies, plus 10 for each time the user's Charge has turned into energy since it began. Channeled, Stealthy.
- inline statuses: dark_hum · ops: setCounter, apply, damage
  - inline `dark_hum` (Neutral; triggers: energyFromEffect, turnEnd): At the end of each of the bearer's turns, deals 10 damage to all enemies, plus 10 for each time their Charge has turned into energy since this began.

### `stab.ion` — Circuit Breaker
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, and a random Buff of theirs ends. If one did, the user gains 1 Charge.
- applies: charged · ops: damage, if, removeRandom, apply

### `ravage.ion` — Arc Ambush
- Ravage · cost Ar · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy; it doesn't wake a Sleeping target, and Saps them twice instead.
- applies: sapped · ops: if, damage, apply

### `mislead.ion` — Signal Jam
- Mislead · cost S · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy or one of their minions uses a Harmful skill, it's countered, and all their minions are blacked out for 2 turns. Invisible.
- applies: blacked_out · inline statuses: signal_jam · ops: apply, removeEffect
  - inline `signal_jam` (Debuff, hidden; triggers: skillUsed/counter): The next Harmful skill is countered, and every enemy minion is blacked out.

### `stun.ion` — Shutdown
- Stun · cost A · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned for 2 turns and Suppressed for as long. The user can't use skills on their next turn.
- applies: stun, suppressed · inline statuses: powered_down · ops: apply
  - inline `powered_down` (Neutral): Can't use skills.

### `dance.ion` — Ghost in the Machine
- Dance · cost AA · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 2 Swiftness. A random enemy with Buffs is Suppressed for 2 turns, and the user gains copies of their Buffs.
- applies: swiftness, suppressed · ops: apply, forEach, copyEffects

### `heal.ion` — Hard Reboot
- Heal · cost W · cooldown 1 · target **ally** · tags Helpful, Strategic
- Until the end of the enemy's next turn, all of target ally's effects, Buffs and Debuffs alike, are Suppressed. When that ends, they heal 30.
- inline statuses: hard_reboot · ops: apply, heal
  - inline `hard_reboot` (Neutral): The bearer's Buffs and Debuffs have no effect and Debuffs don't tick; when it runs out, they heal 30.

### `bless.ion` — Dead Zone
- Bless · cost r · cooldown 2 · target **ally** · tags Helpful, Strategic
- For 2 turns, each enemy who uses a skill on target ally is Suppressed for 1 turn, and the ally gains 1 Charge.
- applies: suppressed, charged · inline statuses: dead_zone · ops: apply
  - inline `dead_zone` (Buff; triggers: skillTargeted): Each enemy who uses a skill on the bearer is Suppressed for 1 turn, and the bearer gains 1 Charge.

### `curse.ion` — Signal Loss
- Curse · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns, and for as long, their skills can't target their own allies.
- applies: confusion · inline statuses: signal_loss · ops: apply
  - inline `signal_loss` (Debuff): The bearer's skills can't target their own allies.

### `smite.ion` — Null Brand
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, who is Suppressed for 1 turn; allies who damage them meanwhile gain 1 Charge per Buff they have.
- applies: suppressed, charged · inline statuses: null_brand · ops: damage, apply
  - inline `null_brand` (Debuff; triggers: damaged): The applier's allies who damage the bearer gain 1 Charge per Buff the bearer has.

### `prayer.ion` — Lights Out
- Prayer · cost Wrr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20. Every enemy has Blackout for 2 turns, and allies heal 10 more for each enemy minion or channel it pauses.
- macros: blackout · ops: heal, set, forEach, macro

### `cleave.ion` — Pulse Wave
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy and 15 to another enemy with Buffs (any other, if none), who is Suppressed for 1 turn.
- applies: suppressed · ops: damage, if, forEach, apply

### `shout.ion` — Jammed Frequency
- Shout · cost Sr · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- All enemies are Intimidated for 2 turns, and every skill of theirs goes 1 turn further onto cooldown.
- applies: intimidated · ops: apply, adjustCooldowns

### `withstand.ion` — Faraday Cage
- Withstand · cost A · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains 25 Shield for 1 turn. While it holds, any Sapped they would gain becomes Charge instead.
- applies: charged · inline statuses: faraday_cage · ops: apply, removeEffect
  - inline `faraday_cage` (Buff; triggers: effectGained): A Shield; while it holds, Sapped the bearer gains becomes Charge.

### `taunt.ion` — Open Channel
- Taunt · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user until the user next uses a Harmful skill, for up to 3 turns. Each time that enemy damages the user meanwhile, the user gains 1 Charge.
- applies: taunt, charged · inline statuses: open_channel, open_channel_feed · ops: apply, removeSelf, if
  - inline `open_channel` (Neutral; triggers: skillUsed): The bearer's Taunt holds until they use a Harmful skill.
  - inline `open_channel_feed` (Debuff; triggers: dealtDamage): Each time the bearer damages the applier, the applier gains 1 Charge.

### `titan.ion` — Null Colossus
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 3 Armor, and every other unit's Buffs, allies' included, are Suppressed.
- applies: armor, suppressed · ops: apply

### `shadow_drone_scramble` — Scramble (minion skill of `shadow_drone`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, Strategic, Stealthy
- Target enemy is Suppressed for 1 turn. Stealthy.
- applies: suppressed · ops: apply

### `shadow_drone_needle_arc` — Needle Arc (minion skill of `shadow_drone`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 Piercing damage to target enemy; it ends the Drone's Stealth.
- ops: damage

### `jammer_static_hiss` — Static Hiss (minion skill of `jammer`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `shadow_drone` — Shadow Drone, 20 HP; skills: shadow_drone_scramble, shadow_drone_needle_arc
- `jammer` — Jammer, 15 HP; skills: jammer_static_hiss

## Named statuses defined here (3) — this group owns their default animations

- `suppressed` — Suppressed (Debuff): The bearer's Buffs have no effect while it lasts; they still tick down and can still be removed. _Applied by skills in: ion._
- `blackout` — Blackout (Debuff): The bearer's minions can't use skills and their effects pause. _Applied by skills in: none directly._
- `blacked_out` — Blackout (Debuff): A blacked-out minion can't act, and its effects pause. _Applied by skills in: ion._

## Macros defined here (1) — this group owns their default animations

- `blackout`: ops apply; applies blackout, blacked_out. _Used by: ion._
