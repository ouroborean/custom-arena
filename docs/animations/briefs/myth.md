# Myth — animation brief

Group id: `myth`. Element(s): Ice + Earth. Concept file: `docs/animations/concepts/myth.yaml`.
Skill source: `packages/content/data/fusions/myth/skills.myth.yaml`; minions: `packages/content/data/fusions/myth/minions.myth.yaml`; statuses: `packages/content/data/fusions/myth/statuses.myth.yaml`; macros: `packages/content/data/fusions/myth/macros.myth.yaml`.

## Skills (33)

### `strike.myth` — Jotun Fist
- Strike · cost W · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, or 30 if the user has no allied minions. Mythic: it also hits a random other enemy for 15.
- ops: damage, if

### `smash.myth` — Mountain Stomp
- Smash · cost Sr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy and 10 to their allies, +5 to each hit per allied Boulder. Mythic: the user creates a Boulder for each enemy it hits.
- summons: boulder · ops: set, damage, if, summon, repeat

### `charge.myth` — Mammoth Charge
- Charge · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. If the user has a Boulder, it's destroyed to add half its HP to the hit; if not, they create one. Mythic: the Boulder isn't destroyed.
- summons: boulder · ops: if, forEach, set, damage, kill, summon

### `riposte.myth` — Runic Ward
- Riposte · cost r · cooldown 1 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters the first Harmful skill used on the user, and creates a Boulder when it does. Mythic: it reflects the skill instead of countering it. Invisible.
- inline statuses: runic_ward_mythic, runic_ward · summons: boulder · ops: if, apply, summon
  - inline `runic_ward_mythic` (Buff, hidden; triggers: skillTargeted/reflect): Reflects the first Harmful skill used on the bearer and creates a Boulder.
  - inline `runic_ward` (Buff, hidden; triggers: skillTargeted/counter): Counters the first Harmful skill used on the bearer and creates a Boulder.

### `rage.myth` — Call of the Saga
- Rage · cost SI · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains 2 Legend and creates a Boulder, then becomes Immune for 2 turns.
- applies: immune · macros: gain_legend · summons: boulder · ops: forEach, macro, summon, apply

### `shot.myth` — Hurl the Stone
- Shot · cost r · cooldown 0 · target **any** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy, plus 5 per Legend the user has. Can instead target an allied Boulder: it's destroyed, and the user gains 1 Legend per 15 HP it had (at most 3).
- macros: gain_legend · ops: if, damage, set, repeat, forEach, macro

### `snipe.myth` — Giant's Spear
- Snipe · cost Ar · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- 20 Piercing damage to target enemy, growing by 20 at the end of each of the user's turns. It lands at 60, or as soon as the user takes damage. The target of this skill is invisible. Channeled.
- inline statuses: giants_spear · ops: setCounter, apply, if, removeSelf, damage
  - inline `giants_spear` (Neutral; triggers: turnEnd, damaged): Grows 20 each turn; lands at 60, or when the bearer takes damage.

### `trap.myth` — Troll Bridge
- Trap · cost W · cooldown 3 · target **allEnemies** · tags Harmful, Strategic, Invisible
- For 3 turns, whenever any enemy uses the same skill they used on their previous turn, they take 20 damage. Invisible.
- inline statuses: troll_bridge · ops: apply, set, if, damage, setCounter
  - inline `troll_bridge` (Debuff, hidden; triggers: skillUsed): Using the same skill as on their previous turn costs the bearer 20 damage.

### `maneuver.myth` — Barrow
- Maneuver · cost r · cooldown 4 · target **self** · tags Helpful, Strategic
- The user is Stunned and Invulnerable until the end of their next turn, and gains 1 more Legend.
- applies: invulnerable, stun · macros: gain_legend · ops: apply, forEach, macro

### `companion.myth` — Mammoth
- Companion · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons a Mammoth (55 HP) permanently; while it stands, Frost debuffs on enemies can't be removed. Trample (r): 15 damage to all enemies.
- summons: mammoth · ops: summon

### `bolt.myth` — Frost Rune
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy; the user gains 1 more Legend if they have a Frost debuff. Mythic: their Frost debuffs also spread to a random ally of theirs.
- applies: frostbitten, chilled, numb, snowbound · macros: gain_legend · ops: damage, if, forEach, macro, apply

### `blast.myth` — Age of Ice
- Blast · cost Irr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 25 damage to all enemies. Enemy minions it kills become allied Boulders. Mythic: every enemy minion it hits becomes one, dead or not.
- summons: boulder · ops: damage, forEach, set, if, kill, summon

### `consume.myth` — Draught of Ages
- Consume · cost W · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, healing the user for it and 5 more for each round the battle has lasted (max 40).
- ops: damage, heal

### `summon.myth` — Trollkin
- Summon · cost I · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons 2 Trolls (20 HP) for 3 turns. Club (r): 10 damage to target enemy. When a Troll dies or expires, an allied Boulder with 20 HP is created in its place.
- summons: troll · ops: summon

### `channel.myth` — Awakening the Ancients
- Channel · cost Ir · cooldown 3 · target **self** · tags Helpful, Strategic, Channeled
- For 3 turns, the user creates a Boulder at the end of each of their turns. When it ends, every allied Boulder becomes a Rime Giant (Frost Maul (nc): 15 damage). Channeled.
- inline statuses: awakening_the_ancients · summons: boulder · ops: apply, summon, transformMinion
  - inline `awakening_the_ancients` (Neutral; triggers: turnEnd): Each turn, a Boulder; when it ends, every allied Boulder becomes a Rime Giant.

### `stab.myth` — Rimecut
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, +5 per Frost debuff on them (max 25 in all).
- ops: damage

### `ravage.myth` — Giant-Slayer
- Ravage · cost Wr · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 Piercing damage to target enemy, +20 if they have more HP than the user. If it kills, the user gains 1 more Legend. Mythic: the bonus always applies.
- macros: gain_legend · ops: damage, if, forEach, macro

### `mislead.myth` — Frozen Riddle
- Mislead · cost A · cooldown 2 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and for 3 turns their cooldowns don't tick down while they have a Frost debuff. Invisible.
- inline statuses: frozen_riddle, riddled · ops: apply
  - inline `frozen_riddle` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered, and their cooldowns don't tick down while they have a Frost debuff.
  - inline `riddled` (Debuff): The bearer's cooldowns don't tick while they have a Frost debuff.

### `stun.myth` — Turned to Stone
- Stun · cost Ar · cooldown 4 · target **enemy** · tags Harmful, Strategic
- Target enemy is Stunned and gains 25 Shield for 3 turns; the Stun ends if the Shield breaks. Mythic: it doesn't.
- applies: stun · inline statuses: stone_shell, turned_to_stone · ops: apply, if, removeEffect, removeSelf
  - inline `stone_shell` (Buff): A Shield; when it breaks, the Stun ends.
  - inline `turned_to_stone` (Neutral; triggers: ownEffectEnded): When the Stone Shell breaks, its bearer's Stun ends.

### `dance.myth` — Retold Saga
- Dance · cost AI · cooldown 5 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Might, 1 Swiftness and 1 Focus, and 1 more of each for every earlier use of this skill in the battle.
- applies: might, swiftness, focus · ops: apply

### `heal.myth` — Rime Cairn
- Heal · cost r · cooldown 1 · target **ally** · tags Helpful, Strategic
- Target ally heals 20, and the user creates a Boulder with 10 HP for each Frost debuff on the enemy team (max 40).
- summons: boulder · ops: heal, set, if, summon, addMaxHp

### `bless.myth` — Ancestral Gift
- Bless · cost free · cooldown 0 · target **ally** · tags Helpful, Strategic
- Target ally gains 1 Might or 1 Armor at random for 2 turns; an allied minion gains both. Mythic: a non-minion ally also becomes Mythic until the end of their next turn.
- applies: might, armor · macros: become_mythic · ops: if, apply, random, set, forEach, macro

### `curse.myth` — Kinslayer's Doom
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy is Confused for 2 turns. If they die before it ends, every ally of theirs is Confused for 2 turns.
- applies: confusion · inline statuses: kinslayers_doom · ops: apply
  - inline `kinslayers_doom` (Debuff): If the bearer dies before this ends, every ally of theirs is Confused for 2 turns.

### `smite.myth` — Deed of Renown
- Smite · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. For 1 turn, each ally who damages them gives the user 1 Legend. Mythic: those allies also gain 1 Armor.
- applies: armor · inline statuses: deed_of_renown · macros: gain_legend · ops: damage, apply, forEach, macro, if
  - inline `deed_of_renown` (Debuff; triggers: damaged): Each of the applier's allies who damages the bearer earns the applier 1 Legend.

### `prayer.myth` — Song of the Saga
- Prayer · cost Irr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20, and allied minions heal to full. Mythic: allies also gain 20 max HP while the user stays Mythic.
- inline statuses: song_of_the_saga · ops: heal, if, apply
  - inline `song_of_the_saga` (Buff): +20 max HP while the applier stays Mythic.

### `cleave.myth` — Jotun Sweep
- Cleave · cost W · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy, and 1 random other enemy per Legend the user has takes 10. Mythic: every other enemy takes 10 and is Frostbitten for 1 turn.
- applies: frostbitten · inline statuses: jotun_swept · ops: damage, if, forEach, apply, repeat, removeEffect
  - inline `jotun_swept` (Neutral): Already hit by this skill.

### `shout.myth` — Horn of the North
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For each enemy, a random skill of theirs that's cooling down is set back 2 turns (3 while the user is Mythic). An enemy with nothing cooling down is Intimidated for 2 turns instead.
- applies: intimidated · ops: forEach, if, adjustCooldowns, apply

### `withstand.myth` — Frozen Rampart
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user creates a Boulder (25 HP), and until their next turn, while they have an allied minion, each direct hit on them is split: they take half, and a random allied minion takes the other half.
- inline statuses: frozen_rampart · summons: boulder · ops: summon, addMaxHp, apply, if, damage
  - inline `frozen_rampart` (Buff; triggers: damaged): While the bearer has an allied minion, direct hits on them are halved, and a random allied minion takes the other half.

### `taunt.myth` — Old Feud
- Taunt · cost W · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted until the user next becomes Mythic (at most 4 turns); if it ends that way, they take 25 damage. If the user is already Mythic, the Taunt lasts 2 turns.
- applies: taunt · inline statuses: old_feud, old_feud_oath · ops: if, apply, forEach, removeEffect, damage, removeSelf
  - inline `old_feud` (Debuff): Taunted until the applier becomes Mythic; then they take 25 damage.
  - inline `old_feud_oath` (Neutral; triggers: effectGained): When the bearer becomes Mythic, the enemy they Taunted with Old Feud is no longer Taunted and takes 25 damage.

### `titan.myth` — Awakened Giant
- Titan · cost IW · cooldown 4 · target **self** · tags Helpful, Strategic
- The user becomes Mythic now, for 3 turns +1 per Legend they had, and is Immune for as long.
- applies: immune · macros: become_mythic · ops: set, apply, forEach, macro

### `mammoth_trample` — Trample (minion skill of `mammoth`)
- Minion · cost r · cooldown 0 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 15 damage to all enemies.
- ops: damage

### `troll_club` — Club (minion skill of `troll`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

### `rime_giant_frost_maul` — Frost Maul (minion skill of `rime_giant`)
- Minion · cost free · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy.
- ops: damage

## Minions (3)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `mammoth` — Mammoth, 55 HP; skills: mammoth_trample
- `troll` — Troll, 20 HP; skills: troll_club
- `rime_giant` — Rime Giant, 45 HP; skills: rime_giant_frost_maul

## Named statuses defined here (3) — this group owns their default animations

- `legend` — Legend (Neutral): At 3 Legend, the bearer becomes Mythic for 3 turns; Legend resets when Mythic ends. _Applied by skills in: none directly._
- `mythic` — Mythic (Buff): +20 max HP (and 20 healing), 2 Armor, can't be Stunned, and Myth skills gain their Mythic riders. _Applied by skills in: none directly._
- `saga` — Saga (Neutral; triggers: skillUsed, signal): Gains 1 Legend each time this character uses a Myth skill (except Awakened Giant) or kills an enemy or minion; at 3, they become Mythic. _Applied by skills in: none directly._

## Macros defined here (2) — this group owns their default animations

- `gain_legend`: ops if, apply, set, macro; applies legend. _Used by: myth._
- `become_mythic`: ops removeEffect, if, addMaxHp, heal, apply; applies mythic. _Used by: myth._
