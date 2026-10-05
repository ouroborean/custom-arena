# Equipment passives and the economy (Phase 7)

This document covers three things:
- **Item passives:** how they work (§1–2) and how each ambiguous passive was read (§3). The passives
  now live on **Sigils** (§6); §3 still names them by the static items they came from.
- **The economy:** gold, rewards, drops, forging and salvage (§4).
- **Modular equipment:** components, forged pieces and their names (§6).

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

### Type G (Signature Gear)

Class-themed, but any character can equip it.

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
Casual, ranked and practice matches pay these amounts; private matches pay nothing. **Practice** (vs a
bot, decided 2026-10-03) is issued and verified by the server like a story attempt: it picks the seed
and both teams, and replays the submitted commands before paying (`routes/practice.ts`). Its win drops
a component with half the casual chance (`drops.chance: 0.5`).

| | Win | Loss (played out) | Draw |
|---|---|---|---|
| Casual | 40 Gold + 1 drop | 15 Gold | 20 Gold |
| Ranked | 60 Gold + 1 drop | 20 Gold | 30 Gold |
| Practice | 25 Gold + a drop half the time | 15 Gold | 20 Gold |

Anti-farming rules:
- **Minimum length:** matches shorter than 8 turns (both players' turns counted) pay no one.
- **No pay for forfeits:** losses by surrender, disconnect or AFK pay nothing.
- **Daily cap:** at most **10 item drops** per account per UTC day, practice included. Wins beyond that
  still pay gold.
- **At most once:** rewards are stored in `match_rewards`, keyed by match and player (practice: on its
  attempt, `sp_attempts.reward`, paid by the first submission only).
- **Where rewards show:** they are granted when the room store finishes the match, sent in
  `match.end.reward`, and listed in match history.

### Drops, forging and salvage
- **Drops:** the `standard` table picks a component type by weight (Shard 60, Skill 30, Sigil 10),
  then one of that type's components uniformly. Only single components drop; forged pieces are made
  by players.
- **Forging:** two unequipped pieces become one, for **50 Gold** (2 components) or **100 Gold**
  (3). **Splitting** a forged piece back into its components costs **25 Gold**. See §6.
- **Salvage:** an unequipped piece pays gold for each component: Skill 10, Shard 5, Sigil 30.
- **Equipped pieces:** forging, splitting and salvage refuse them, returning 409.

### 4.1 Player levels and loot boxes (2026-10-05)
Numbers live in `economy.progression.yaml`, rules in `@arena/meta` (`progression.ts`), storage in
`player_progress` and `loot_boxes` (migration 0013).

- **Experience:** every finished match pays experience along with its other rewards, under the same
  rules (no forfeited losses, nothing below 8 turns, private matches pay none). It's added in the
  transaction that pays the match, so at most once.

  | | Win | Loss | Draw |
  |---|---|---|---|
  | Casual | 100 | 40 | 50 |
  | Ranked | 120 | 50 | 60 |
  | Practice | 60 | 25 | 30 |
  | Arcade | 80 | 30 | 30 |
  | Story | 80 | 25 | 25 |
  | Tutorial | 60 | 20 | 20 |

- **Levels:** level L takes 400 + 100 × (L − 1) experience, at most 1200 (400, 500, … 1200).
- **The bar:** it has a bubble at **25%** (uncommon box), **50%** (rare), **75%** (uncommon) and
  **100%** (epic, the level-up). Reaching a bubble stores its box; one big gain pays every bubble it
  crosses, across levels.
- **Loot boxes:** the player opens them from Home. Each holds **3 rolls**, shown lowest first, and
  each roll lands in a band:
  - **Gold** (the lowest): an amount in the box's range.
  - **Gear:** tier 1 or tier 2, weighted by the box's quality.
  - **Prize:** a tier-3 piece.

  A gear **tier is its component count**: tier 1 is a single component from the `standard` table;
  tiers 2 and 3 are pieces already forged from 2 or 3 components. A forged piece always starts from a
  Skill, so it grants one, followed by the table's draws. It's a legal piece, named as if forged in
  that order.

  | Box | Gold / Gear / Prize | Gold | Gear tier 1 / 2 |
  |---|---|---|---|
  | Uncommon | 60 / 37 / 3 | 20–50 | 85 / 15 |
  | Rare | 40 / 52 / 8 | 40–90 | 60 / 40 |
  | Epic | 15 / 60 / 25 | 80–160 | 30 / 70 |

- **Box rewards** don't count toward the daily drop cap. Opening a box is a conditional update, so it
  pays once; gear goes into the inventory with source `lootbox:<box>`.

### API
| Method | Path | |
|---|---|---|
| GET | `/api/progress` | `{ level, xp, needed, total, boxes }`: the bar and unopened boxes |
| POST | `/api/loot-boxes/:id/open` | → `{ box, rolls, wallet, progress }`; 404 for someone else's box, 409 once opened |
| POST | `/api/dev/xp` | `{ xp }`: development only, like `/api/dev/grant` |
| GET | `/api/wallet` | Balances (also returned by `/api/inventory`, rolls, forging, splitting and salvage) |
| POST | `/api/characters/roll` | Costs the roll price |
| POST | `/api/forge` | `{ base, addition }` (instance ids) → `{ item, wallet }`, the new piece |
| POST | `/api/inventory/:id/split` | → `{ items, wallet }`, one instance per component |
| POST | `/api/inventory/:id/salvage` | → `{ paid, wallet }` |

### Client
- The header shows the wallet.
- The roll button shows its price.
- The inventory panel is the forge: a base + addition bench with a live preview of the result's name
  and cost, and per-piece actions (use as base or addition, split, two-click salvage).
- Rewards appear on the game-over dialog and in match history.

### Not built yet
- Story and chapter rewards (Phase 6).
- Achievement predicates.

## 5. Simulator

`npm run sim -- --games 2000 --equip` sets up each match as follows:
1. Characters are recruited like players' (class, element, skills).
2. Each gets a random loadout that the resolver accepts (`randomLoadout` in `@arena/meta`).
3. The sim reports each component's team win rate (a team "has" a component when any of its pieces
   holds it).

The first 2000-game run finished without errors. Per-item samples are still small (roughly 20–120
games each), so single-item extremes are mostly noise; balance work needs larger runs. Plain runs
(without `--equip`) are unaffected: about 40 ms per match both before and after Phase 7.

## 6. Modular equipment (2026-10-02)

The static items (the sheet's types A–L) were replaced by **components** that players forge into
pieces. A character still has four slots (`docs/meta.md` §2.1), and each slot takes one **piece**.

### Components
`packages/content/data/items/items.yaml` holds 160 components:

| Type | Count | Grants | Ids |
|---|---|---|---|
| **Skill** | 30, one per base skill | the skill (added if the character lacks it) | `longsword`, `greathammer`, … |
| **Shard** | 10, one per element | one infusion for the pool | `fire_shard`, … |
| **Sigil** | 120, one per item passive | the passive (its status, applied at match start) | `sigil_momentum`, … |

Each Sigil comes from one of the old static items, and its status keeps that item's id
(`sigil_momentum` → `eq_wind_katana`), so the rulings in §3 still apply. Content validation checks
each type's shape, one Skill per base skill and one Shard per element.

### Pieces
- **What a piece is:** one component, or up to **3** forged together, with at most **one Sigil** and
  **no skill twice**. Elements can repeat (Fire + Fire is a Dragon Crystal).
- **Its id** is the component ids joined with `+`, in forge order:
  `longsword+wind_shard+sigil_momentum`. A single component's id is just its own. The database,
  loadouts, rewards and match specs all store this id; `@arena/engine` `pieces.ts` parses it
  (`describePiece`, `pieceProblems`, `pieceName`).
- **What it grants:** everything its components grant. Its skills go into the character's skill pool,
  to be prepared (`docs/meta.md` §2.2); the 5-skill cap counts prepared skills, and its Sigil is the
  character's one item passive.

### Names
Names come from the components and their order, with the tables in
`packages/content/data/items/forging.yaml`; `docs/forging-names.md` explains the scheme. A piece is
`[prefix] Base [suffix]`:
- **Skills:** one is the Skill's own name, two take the pair's name, and a third adds its prefix to
  the first two's pair (*Reckless Saint Bow*).
- **Shards on a skill piece:** an `<Element>-Infused` or `<Fusion>-Infused` prefix.
- **Shards alone:** *Fire Shard*, *Dragon Crystal* (*Pure Crystal* for Ice + Ice), *Geode of the True
  Dragon*.
- **A Sigil:** its suffix ends the name (*of Momentum*); alone it is *Sigil of Momentum*.

Validation checks that the tables name every pair of skills, every set of three elements and every
skill's prefix, with no name used twice.

### Forging and splitting
- **Forging** takes two unequipped pieces, a **base** and an **addition**, and makes one piece whose
  components are the base's followed by the addition's. The base keeps its name and gains a prefix
  or suffix, and swapping the two changes the result's name. A result that breaks the piece rules is
  refused (400), and both inputs are kept.
- **Costs:** 50 Gold for a 2-component result and 100 Gold for 3 (`economy.forge.cost`).
- **Splitting** turns an unequipped forged piece back into its components for 25 Gold
  (`economy.split.cost`). A single component can't be split.
- **Rules:** `forge` and `splitPiece` in `@arena/meta` (`economy.ts`). The server routes are
  `POST /api/forge` and `POST /api/inventory/:id/split` (§4 API).

### Moving from static items
- **Migration 0009** (`0009_modular_items.sql`) turns every retired item into the piece of its parts:
  skills, then infusions, then its passive's Sigil. *Wind Katana* becomes
  `longsword+wind_shard+sigil_momentum`, a Wind-Infused Longsword of Momentum. It rewrites owned
  instances, loadouts, presets, and match and season reward history.
- **Story, achievement and tutorial rewards** name the same pieces.
- **The starter kit** is a Shard, a Skill, and another Skill forged with a Shard.
- **No free inventory:** the testing mode that gave every account free copies of all equipment was
  removed (2026-10-03); migration 0011 deletes those copies unless a character wears them. Accounts
  build their equipment from the starter kit, drops and rewards, as players do.
