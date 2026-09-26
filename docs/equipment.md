# Equipment passives and the economy (Phase 7)

This document covers two things:
- **Item passives:** how they work (§1–2) and how each ambiguous passive was read (§3).
- **The economy:** gold, rewards, drops, crafting and salvage (§4).

The simulator's equipment mode is described in §5.

The GDD sections are §8 (equipment) and §8.4 (acquisition). Slots, budgets and loadout validation
are covered in `docs/meta.md` §2.

## 1. How passives work

- **A passive is a status.** Each item with passive text has one implementation: a status with
  the id `eq_<item id>`, stored in `packages/content/data/items/statuses.passives-{a,b,d,g,h}.yaml`.
  The item points at it with `passiveEffect`.
- **When it applies.** The loadout resolver (`@arena/meta`) lists the equipped passives in
  `CharacterSpec.passives`. The engine applies each one to its wearer at match start, permanently.
- **No special case.** A passive is an ordinary effect with modifiers and triggers (GDD §8.1), so
  the engine treats it like any other status.
- **Passive statuses are Neutral.** They can't be cleansed, stolen or blocked the way Buffs can.
  The Buffs and Debuffs they hand out are ordinary statuses, and those can be.
- **All 120 passives are implemented:** types A (30), B (20), D (30), G (20) and H (20). Types C,
  E, F, I, J and K have no passive text.
- **The character screen** shows each equipped item's sheet text next to its implementation's own
  wording (the status description), which spells out the rulings.

### 1.1 Conventions

| Wording | Reading |
|---|---|
| "your X skills" | Skills of archetype X, base or elemental (Strike includes Fire's Strike, …) |
| "for 1 turn" on a benefit to yourself you get on your own turn | Until the end of your next turn (`ownTurns: 1`) |
| "for 1 turn" on anything else | The skill convention: this turn and the opponent's next (`enemyTurns: 1`) |
| "+1 turn" to a duration | 2 internal ticks: one full round (rules.md, "Extending Stuns") |
| A gain with no duration | Permanent (Q16): Swiftness, Might, Armor and similar |
| "Once per round" | Once per **match** (GDD §5.1) |
| "Stunned" | A full stun: Stun, Stun (non-Strategic), Stun (Strategic) or Sleep, unless the text is narrower |
| "damaging skill" | A non-Strategic skill (the skills that deal direct damage) |
| "an ally" | Another allied unit, not you, unless the text includes you |
| "primary target" | The first target of the skill |

## 2. Engine vocabulary added for equipment

Everything below is data-language vocabulary (`packages/engine/src/defs.ts`, schema in
`packages/content/src/schema.ts`). None of it is specific to an item.

### Every modifier can carry
- `if`: a condition on the bearer.
- `archetypes`: only for skills of these archetypes.
- `skillsWith`: only for skills with these tags.

### Modifiers
- **Damage dealt:** `damageDealt` gains `value`, `target`, `mul` and `onePerTurn` (the target is
  picked at damage time).
- **Damage taken:** `damageTaken` gains:
  - `value` and `mul`;
  - `atLeast` with `oncePerTurn`: big-hit reductions applied before Armor.
- **Armor:** `armorMul`.
- **Costs:**
  - `costToRandom`: every pip becomes random energy;
  - `freeSkills`;
  - `costSpecific`: drops specific pips, the most common color first.
- **Skills and targeting:**
  - `skillTags`: add or remove tags such as Bypass, Uncounterable or Unstunnable;
  - `extraTargets`: extra legal targets, with alternative ops, or cast as if the target had used
    the skill;
  - `targetExclude`.
- **Cooldowns and channels:** `cooldownOnUse` gains `min`; `keepChannels`.
- **Damage routing and Bypass:** `redirectDamage`; `exposed` (the effect's source Bypasses against
  the bearer).
- **Other:**
  - `maxHp`: bonus max and current Health while the effect lasts; Health is capped when it ends;
  - `stackCap`: a non-stacking effect this unit applies may stack.

### Trigger events
- **Effects you applied:** `ownEffectTriggered` and `ownEffectEnded` (filter on `reason` and
  `untriggered`), `effectApplied`.
- **Healing:** `healed` (on the target), `healDone` (on the healer).
- **Match start:** `battleStart`.
- **Counters and negation:**
  - `countered` (on the stopped skill's user);
  - `counterIgnored` (Flow shrugged off a counter);
  - `effectNegated` (your effect was stopped) and `incomingNegated` (your Swiftness stopped
    something).
- **Energy:** `energyFromEffect` (Charged paying out).

### Trigger filters
- `when.archetypes`, `counter`, `reflected` and `reason`;
- `untriggered`, `effects`, `kind`, `shield` and `toEnemy`.

### Broadcast signals
- `died` carries the killer, the killing skill and a snapshot of the dead unit's effects.
- `countered`, `summoned` and `unitDamaged`.
- `applying:<status>` fires on every application attempt, before any block.
- `stab_bonus` and `channel_earth` are sent by content.

### Ops
- **Skills:** `castSkill` casts a content skill, your own skill of an archetype, or the event's
  skill, optionally as each target.
- **The event's effect:**
  - `eventEffect`: make it permanent, extend it, or `expireNow` (a delayed payload goes off at
    once);
  - `copyEventEffect`.
- **Moving effects:** `removeRandom`, `stealRandom` (optionally non-elemental only).
- **Shields:** `boostShields`.
- **Durations:** `extendEffects` by kind, with exceptions, and once per effect.
- **Cooldowns:** `adjustCooldowns` with archetypes, `exceptEvent` or `random`; `resetCooldown`
  with archetypes.
- **Damage:** `damage` with `raw` (no modifiers).
- **Healing:** `heal` with `raw` and/or `quiet`.
- **Applying effects:** `apply` with:
  - `quiet` (applications that set off nothing);
  - `whileActorHas` ("during Titan");
  - `linkToEvent` ("while the Taunt lasts").

### Values, conditions, selectors and durations
- **Values:** `skillCost`, `deadCount`, `alliesActed`, `eventAmount`, `eventDuration`, `energy`.
- **Conditions:**
  - `isEventTarget`, `appliedFromArchetype`, `eventTargetHad`, `eventSkill` (archetypes, cost,
    tags);
  - `channeling`, `stunned`, `actedThisTurn`;
  - `has.mine`, `hasFromArchetype.mine`, `minion.fromArchetypes` / `minion.mine`.
- **Selector:** `eventPrimary`.
- **Durations:** `raw` accepts values; `sameAsEvent`.

### Content changes
- Stab variants signal `stab_bonus` when their bonus applies.
- Seedlings' Channel Earth signals `channel_earth`.
- Ignite burns 5 per stack. It only stacks with Emblem of the Inferno.
- Expiry payloads run through one helper, used both at turn end and by `expireNow`.

## 3. Rulings

Every passive's own `description` states exactly what it does. Where the sheet was ambiguous, this
is how it was read.

### Type A (Main Hand)
- **Wind Katana:** "total cost" is the Strike's base cost.
- **Water Spear:** after a Charge, every cost is random energy until the end of your next turn.
- **Poison Rapier:** once per match.
- **Unholy Cleaver:** 10 Shield per full 20 missing Health, gained when Rage is used.
- **Ice Kunai:** each Shot hit marks the target; each mark adds 5 to your later Shots against it.
- **Lightsaber Dirk:** the Maneuver resolves as if the ally had used it on themselves.
- **Twisted Wand:** allied minions from Summon skills become legal Consume targets.
- **Holy Censer:** checked at the end of each of your turns.
- **Lightning Dagger:** counts your characters that used a skill earlier this turn.
- **Sun Baton:** any full stun you apply to an enemy; Shattered lasts as long as the stun.
- **Hoop Blade:** only the Dance just used is exempt.
- **Wind Charm Stick:** "heal 5 more" is a 5-per-turn heal over your next 2 turns.
- **Book of the Damned:** targets at full Health after the Prayer also get the base Bless skill cast on them.
- **Paladin Axe:** the enemies the Cleave's direct damage didn't touch.
- **Ice Hammer:** your Taunt skills are locked while one of your Taunts is on the board.
- **Chemtech Sword:** heals once per turn, however many Titan effects expire together.

### Type B (Two-Handed)
- **Soldier Greataxe:**
  - Using Rage arms it; the first enemy damage while a Rage effect is on you triggers your Charge
    (base Charge if you have none).
  - It fires once per Rage.
- **Tracker's Whistle:**
  - "Maneuvers that only target the user" means the Maneuver's targets were just you.
  - Each Companion minion then casts that same Maneuver on itself.
- **Summoner's Scrollstaff:**
  - "Start Channeling" means using a Channeled skill.
  - It affects the Summon minions on the board at that moment.
- **Staff and Shield:**
  - "Below 40" means 39 or less.
  - Your own Bless variant is cast on you (base Bless if you have none).
- **High Priest Staff:** your Bless is cast on every ally that doesn't already carry your Bless.
- **Tree Club:**
  - "During Titan" means while you carry an effect from your Titan skill, so Titan variants that
    give you nothing do nothing.
  - It covers Companions present when Titan resolves or summoned during it.
  - +20 max and current Health; when it ends, max Health drops back and Health is capped.
- **Spear and Shield:**
  - "Withstand was not broken" means your Withstand's effects ran out without the Shield breaking.
  - Your next Charge then deals double.
  - A broken Withstand cancels a pending bonus.
- **Sword and Shield:**
  - The Weakness lasts exactly as long as the Taunt.
  - The Might is a bonus while a Withstand effect is on you, not a Might status.
- **Cultist Scythe:**
  - "A Stun target" means a Stunned target.
  - The 10 Affliction ignores every modifier.
- **Staff and Beads:**
  - "1 less Specific" removes a pip of the most common color.
  - It lasts until the end of your next turn.
- **Mace and Greatshield:** real Armor and Weakness statuses, so they can be removed.
- **Paladin's Greatsword:**
  - Any Buff you apply counts.
  - Might once per ally, ever; Armor up to 2 in total.

### Type G (Class Armor)
- **Barbarian Greatclub:** one skill use whose direct damage hit every living, targetable enemy,
  minions included.
- **Helmet of the Ancestors:**
  - Direct hits only.
  - "30 or more" is measured after Might and Vulnerable, before Armor.
- **Shadowrune Bolas:** Confusion for as long as the stopped Stun would have lasted.
- **Mask of Many Faces:**
  - Every counter or reflect on the board counts.
  - 10 if the stopped skill was an enemy's; 5 if it was an ally's, yours included.
- **Boomerang Blade:**
  - "The triggerer" is whoever set the Trap off.
  - It lasts until the end of your next turn.
- **Ricochet Rifle:** counters only, not reflects. Mask of Many Faces names them separately.
- **Explosive Relic:** the skill's base cost.
- **High Wizard's Hat:** any full stun while you carry a channel, whether or not it interrupts it.
- **Hand of Blessing:** the first Buff you give another ally each turn (either player's turn).
- **Robe of the Song / Footwraps:** your Helpful skills gain Unstunnable. Footwraps lasts until the
  end of your next turn.
- **Totem of the Fallen:** the killer must be an enemy; a minion's own time running out doesn't
  count.
- **Rod of Domination:**
  - Your damage to yourself isn't redirected.
  - "No Minions" means no living allied minion.
- **Blood Chalice:**
  - It covers minions of either side.
  - The Buff is one of Might, Armor or Swiftness, permanent.
- **Visor of the Restful Spirit:**
  - "Last turn" means since the end of your previous turn.
  - The Might lasts this turn.
- **Hand of Healing:** AoE Heals skip you as well.

### Type H (Accessory)
- **Flame Whip:** an allied character's death, not a minion's.
- **Frozen Gauntlets:** every Shield effect on you gains 10.
- **Glacial Pendant:**
  - Effects of your Stun or Curse skills running out, not being removed.
  - Once per skill type per turn.
- **Winged Sandals:**
  - The first damage each turn.
  - It picks a random one of those skills that is on cooldown.
- **Cybernetic Enhancements:** until the end of your next turn.
- **Chalice of Life:**
  - Focus for the turn at the start of each of your turns while a Channel or Rage effect is on you.
  - 1 Confusion until the end of your next turn when the last one ends.
- **Crown of the Caller:** Buffs your Summon or Companion minions gain are copied to you.
- **Lotus Essence:** +1 turn to every Debuff except Stun and Sleep.
- **Cloak of Night:** a skill with no cooldown stays at 0.
- **Revered Crown:**
  - Other allies only.
  - Its Shield and healing can't be modified and set off nothing.
- **Penance Lash:** +1 turn on every timed effect those skills apply.
- **Helm of the Damned:**
  - A random choice of Might or Armor.
  - It lasts as long as the first effect the skill applied.

### Type D (Elemental Weapon)
- **Inferno:** Ignite stacks to 2 (5 Affliction per stack).
- **Arc Furnace:** damage from your effects (non-direct) only.
- **Hellfire:**
  - Damaging another ally; your own self-damage doesn't count.
  - The Buff is one of Might, Armor, Swiftness or Focus.
- **Permafrost:** 10 Shield on each ally at battle start; allied minions get 5 when summoned.
- **Gale:** the Might ends with the Rush it was gained under.
- **Miasma:**
  - Direct damage.
  - It stops working, per enemy, once that enemy damages you.
- **Monsoon:** your own Swiftness.
- **Tempest:** a single 15 Shield that refreshes rather than stacking.
- **Blackout:**
  - Enemies only.
  - The 10 damage Bypasses the Invulnerability.
- **Aurora:** at the start of your turn, for 1 turn (through the enemy's turn).
- **Tide:** Flow "triggers" when it lets you ignore a counter or reflect.
- **Abyss:** 10 Piercing to a countered enemy, 5 to a reflected one.
- **Bloodtide:** a damaging ability is a non-Strategic skill.
- **Mountain:** any allied Seedling's Channel Earth.
- **Magma:** the first minion you damage each turn takes double from you that turn.
- **Serpent:**
  - Once per turn, whichever happens first.
  - Its stats are permanent.
- **Neurotoxin:**
  - Any energy left banked at the end of your turn.
  - The Might goes to a random allied character.
- **Bog:**
  - The Affliction hits a random enemy.
  - The dead minion is the damage source.
- **Void:** +1 turn on each Invulnerable effect on you, once per effect.
- **Phantom:**
  - Direct damage.
  - The extra 10 Bypasses.
- **Sun:**
  - Direct damage.
  - The Might is permanent.
- **Seraph:** once per match.
- **Plague:** covers Weakness, Vulnerable, Confusion, Intimidated, Toxin and Sapped.

## 4. The economy

All numbers live in `packages/content/data/economy/economy.yaml`. They are first guesses, and
tuning is deferred. The rules are pure functions in `@arena/meta` (`economy.ts`). The server stores
the results.

### Currencies and rolling
- **Gold:** new accounts start with **300 Gold**. Accounts from before the economy start there too.
- **Rolling:** a roll costs **100 Gold**. The first three characters, rolled at registration, stay
  free.
- **Spending is safe:** it is a conditional `UPDATE` inside a transaction. A balance never goes
  negative, and a roll with a full roster (409) or a short wallet (402) takes nothing.

### Match rewards
Casual and ranked matches pay these amounts. Private matches and local practice pay nothing. GDD §2.2
says practice pays "small or none"; practice runs in the browser, so its results can't be trusted.

| | Win | Loss (played out) | Draw |
|---|---|---|---|
| Casual | 40 Gold + 1 drop | 15 Gold | 20 Gold |
| Ranked | 60 Gold + 1 drop | 20 Gold | 30 Gold |

Anti-farming rules:
- **Minimum length:** matches shorter than 8 turns (both players' turns counted) pay no one.
- **No pay for forfeits:** losses by surrender, disconnect or AFK pay nothing.
- **Daily cap:** at most **10 item drops** per account per UTC day. Wins beyond that still pay gold.
- **At most once:** rewards are stored in `match_rewards`, keyed by match and player.
- **Where rewards show:** they are granted when the room store finishes the match, sent in
  `match.end.reward`, and listed in match history.

### Drops, crafting and salvage
- **Drops:** the `standard` table picks a type by weight, then one of that type's items uniformly.
  The weights are A 8, B 5, C 6, D 4, E 8, F 10, G 5, H 6, J 18 and K 30. Perfect Crystals (I)
  don't drop.
- **Crafting:** three **Shards (K)** of one element refine into that element's **Perfect Anima
  Crystal (I)** for 50 Gold (GDD §8.4). Recipes are data; validation checks that each input group
  has exactly one result.
- **Salvage:** an unequipped item pays gold by type: I 60, D 40, B/G/H 35, A/C/E 25, F 15, J 10,
  K 5.
- **Equipped items:** crafting and salvage refuse them, returning 409.

### API
| Method | Path | |
|---|---|---|
| GET | `/api/wallet` | Balances (also returned by `/api/inventory`, rolls, crafting and salvage) |
| POST | `/api/characters/roll` | Costs the roll price |
| POST | `/api/craft` | `{ recipe, instanceIds }` → the new item |
| POST | `/api/inventory/:id/salvage` | → `{ paid, wallet }` |

### Client
- The header shows the wallet.
- The roll button shows its price.
- The inventory panel offers refining whenever enough Shards match, and a two-click salvage.
- Rewards appear on the game-over dialog and in match history.

### Not built yet
- Story and chapter rewards (Phase 6).
- Achievement predicates.
- A server-hosted practice bot, whose results could be trusted enough to pay out.

## 5. Simulator

`npm run sim -- --games 2000 --equip` sets up each match as follows:
1. Characters are rolled like players' (rarity, class, element).
2. Each gets a random loadout that the resolver accepts (`randomLoadout` in `@arena/meta`).
3. The sim reports each item's team win rate.

The first 2000-game run finished without errors. Per-item samples are still small (roughly 20–120
games each), so single-item extremes are mostly noise; balance work needs larger runs. Plain runs
(without `--equip`) are unaffected: about 40 ms per match both before and after Phase 7.
