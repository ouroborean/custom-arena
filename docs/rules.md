# Custom Arena — Formal Ruleset

**Status:** Locked for engine v0.1.0 (Phases 1–3). Source: GDD §3 plus decisions Q1–Q17 and R1–R10 (GDD §14). Element rulings are in §11+.
**Implementation:** `packages/engine`. Each rule below names the module that enforces it.
**Changing a rule:** update this document, the engine, and the matching test in the same change.

Terms in **bold** are defined in [glossary.md](glossary.md).

---

## 1. Match setup — `match.ts`

1. Two players, each fielding 1–3 characters (3 in normal play). Characters have **100 HP** (R4) and 1–5 skills.
2. Player 1 (index 0) moves first, unless the config says otherwise.
3. Each side may have at most **4 living minions** (R5). A summon beyond the cap fails, with a log entry.

## 2. Energy — `energy.ts`, `turn.ts`

1. Colors: **S**trength, **A**gility, **I**ntelligence, **W**isdom. Costs may also include **r** (random / GEN), payable with any color.
2. At the start of a player's turn they gain random-colored energy:
   - on the match's very first turn, 1 energy;
   - otherwise, 1 per living **character** (minions don't count), plus any `energyGain` modifiers.
3. Energy persists between turns with **no cap** (Q2).
4. A player's energy pool is **hidden from the opponent**, both its colors and its count (Q12).

## 3. Turn structure — `commands.ts`, `turn.ts`

A turn belongs to one player. The global turn counter increases by 1 each turn.

1. **Start:** gain energy, then fire start-of-turn triggers.
2. **Planning:** the player queues at most **one skill per unit** (characters and minions). Queueing checks, in order:
   - the unit is theirs and alive, and has nothing queued yet;
   - the skill is off cooldown and the unit can act;
   - the targets are legal;
   - the queue can still be paid for (§4).

   A queued skill can be un-queued. The queue can be reordered, and the player may order their own ticking effects.
3. **Commit** (`endTurn`): the player assigns colors to all **r** costs. The default takes from the colors with the most left over. All queued costs are paid now.
4. **Resolution:** queued skills resolve in queue order through the Use Pipeline (§6). The match ends immediately if a side is eliminated.
5. **End of turn**, in this order:
   1. The player's **ticking effects** fire (DoTs, HoTs, Renew, channel ticks, minion attacks), in their chosen order, then in application order (Q3).
   2. **Every effect on the board** has its duration reduced by 1. Effects that reach 0 expire, and their `onExpire` payloads run (Q1).
   3. This player's **cooldowns** tick down by 1 (Q15).
   4. If both players have taken **50 turns**, the match is a draw (R3).

## 4. Paying costs — `energy.ts`, `queries.ts`

1. Queued costs are payable iff, for each color, specific costs ≤ pool, and total costs ≤ total pool.
2. Cost modifiers apply at queue time. A **Focus**-style reduction lowers only the **r** part and never goes below 0. With no r cost, it reduces nothing (Q8).
3. At resolution, the cost is recomputed. If it has **increased** since queueing, the skill fails and its energy is **refunded**.

## 5. Cooldowns — `queries.ts`, `turn.ts`

1. A skill with cooldown *n* can't be used on its owner's next *n* turns. **CD 1 = unusable on the owner's following turn** (Q15).
2. Internally, using a skill sets `remaining = n + 1 + (Intimidated stacks)`. It drops by 1 at the end of each of the owner's turns, *including the turn of use*. The skill is usable at 0.
3. A **countered** skill still starts its cooldown and keeps its cost spent.
4. A skill that **fails before use** (stunned mid-resolution, dead actor, no legal target) keeps its cost spent but **starts no cooldown** (Q7, R1).

## 6. The Skill Use Pipeline — `pipeline.ts`

For each queued skill:

1. **Can act?** The actor must be alive and not blocked by a stun that covers this skill's class (**Strategic** / non-Strategic). Skills tagged UsableWhileStunned or Unstunnable skip this check. On failure: cost spent, no cooldown.
2. **Cost check:** see §4.3.
3. **Targets are re-resolved:**
   - single-target skills fail if their target died or can no longer be targeted;
   - a **Taunted** actor's enemy target is redirected to the taunter;
   - AoE skills take every currently targetable unit, and fail if there are none.
4. **Cooldown starts.** Using a skill ends the actor's other **channels** (Q6).
5. The `skillUsed` event fires. It's private to the owner for **Invisible** skills. For **HiddenTarget** skills, the targets are hidden from the opponent.
6. Effects that end "when the bearer next uses a skill" (optionally only a Harmful or a damaging one) still apply to this use, and end once it has resolved.
7. **Traps** and other on-use triggers on the actor fire. The skill continues unless the actor died.
8. If the skill is **Harmful** and not **Uncounterable**, the first **counter** or **reflect** in application order intercepts it:
   - counters on the actor (Mislead-type) or on an enemy target (Riposte-type);
   - the interceptor is revealed, and its payload runs;
   - a **Reflect** then applies the skill's effects, from the reflecting unit, to the original user (or the user's whole team, for AoE skills).
9. Otherwise, the skill's ops run in order. Triggers caused by each op resolve before the next op.

## 7. Damage — `damage.ts`

1. **Types** (Q5): Normal, Piercing and Affliction.
   - **Armor** reduces only Normal damage.
   - **Shield** absorbs Normal and Piercing damage.
   - Affliction ignores both.
2. **Direct** damage is damage dealt by a skill's use, including a Snipe's delayed hit. Triggered damage (Mark, Trap, counters) and ticking damage (DoTs, channels, minion auto-attacks) are **indirect**.
3. **Order of operations:**
   1. base amount;
   2. \+ the source's **Might**/**Weakness**, if direct;
   3. \+ the target's **Vulnerable**, if direct;
   4. − the target's **Armor**, if Normal;
   5. floor at 0;
   6. Shield absorption, oldest Shield first;
   7. HP loss.

   **Shattered** turns off steps 4 and 6 (Q10).
4. A direct hit on an enemy that can't currently be targeted deals nothing. For example, a Snipe lands on a target that became Invulnerable.
5. **Invulnerable** blocks indirect enemy damage unless it's Affliction or Bypassing (Q10). An effect flagged `respectsInvulnerable` (Fire's Explode, Q14) never hits Invulnerable targets.
6. A unit at 0 HP dies. Its effects are removed. Triggers it had already queued, such as Sanctify on a killing blow, still resolve.
7. **Win check:** a side with no living characters loses. If both sides are eliminated together, the match is a **draw** (Q9).

## 8. Effects and durations — `effects.ts`, `duration.ts`

1. **Durations** (Q1): every effect stores an integer that drops by 1 at the end of *every* turn, and it's removed at 0. Content declares intent, which the engine compiles when the effect is applied:

   | Intent | Applied on the applier's turn | Applied on the opponent's turn |
   |---|---|---|
   | `thisTurn` | 1 | 1 |
   | `enemyTurns: N` (present for N opponent turns) | 2N | 2N + 1 |
   | `ownTurns: N` (present for N more own turns) | 2N + 1 | 2N |
   | no duration / `permanent` | never expires (Q16) | never expires |

   **Authoring convention for sheet text "for N turns":** `enemyTurns: N`. The effect covers the rest of the current turn plus N turns of each side.
2. **Stacking:** each application is its own instance, and queries sum stacks across instances. `unique` effects (e.g. Mark) refresh the existing instance instead.
3. **Immune** blocks Debuffs. **Swiftness** negates the next Stun by consuming one of its stacks.
4. A newly applied stun ends any of the bearer's channels whose skill it now blocks.
5. **Hidden effects** (Q11) are visible only to the applier's side. They're revealed to both players when triggered. One that expires untriggered is announced to both players.
6. Multiple traps and counters stack on one unit, unless a skill says otherwise.
7. **Minions** count as allies and enemies for every effect. Only text that says "character" excludes them (Q13).

## 9. Randomness and determinism — `rng.ts`, `replay.ts`

1. All randomness comes from the match's seeded RNG (sfc32): energy colors, "random enemy" picks, and later Blind and random debuffs.
2. A match is fully reproduced by (engine version, content version, seed, teams, command log). CI replays recorded matches byte-for-byte.
3. The engine never reads the clock or `Math.random` (enforced by lint).

---

## 10. Interpretations made while encoding the base skills

These are rulings the sheets left open. Each is easy to change in `packages/content/data/base/skills.yaml`.

| Skill | Ruling |
|---|---|
| Strike | The Might gained has no stated duration, so it's **permanent** and stacks with each use (Q16). |
| Charge | The sheet's design note says "next action buff", so the Focus ends when the user **next uses a skill**. |
| Riposte, Mislead | Counter **every** Harmful skill during their duration, not just the first. Shadow's Riposte says "first", which implies the base one doesn't stop at one. |
| Trap | Trap X fires **once** (on the first Harmful skill) and is consumed. |
| Snipe | Fires at the **end of the following turn** (the opponent's). It can be stopped by stunning, killing, or making the target untargetable before then. The hit is direct. |
| Channel | Ticks at the end of each of the user's turns, **starting with the turn it's used**: 2 ticks, or 3 if a damaged enemy is Marked (the extension applies once). Tick damage is indirect, so it doesn't consume Marks. |
| Companion, Summon | Minion attacks are ticks at the end of the owner's turn: indirect damage to a random targetable enemy. **Wolf HP 30, Arcane Familiar HP 20** are placeholders; the sheet gives none. |
| Heal, Bless ("target ally") | "Ally" includes the user. |
| Consume | "Damage dealt" counts damage absorbed by Shield. The Mark/Curse bonus is checked before the hit consumes the Mark. |
| Cleave | The second random enemy is never the primary target. |
| Prayer | Its 10 Shield has no stated duration, so it's permanent until depleted. |

---

## 11. Fire

Content: `packages/content/data/fire/`. Statuses: **Ignite**, **Scorched**, **Flameborn**. Action: **Explode**.

### 11.1 Mechanics

| Term | Ruling |
|---|---|
| **Ignite** | 5 Affliction damage at the end of the applier's turn. One per unit: re-applying refreshes it, and the newest applier becomes its source. There's no stated duration, so it lasts until something removes it (Q16). |
| **Scorched** | Healing received ×0.5, rounded up to a multiple of 5. One per unit. It's permanent unless a skill states a duration. |
| **Flameborn** | One per unit. The bearer heals for the damage their own Ignites deal. They also heal 10 whenever **their side** causes an Explosion. |
| **Explode** | 10 Affliction damage to every enemy of whoever caused it (the skill user, trap setter or channeler). It's indirect damage, and Invulnerable targets are skipped (Q14). Each qualifying target causes its own Explosion, so Chain Detonation, Blastwave and Flamethrower can set off several at once. |

### 11.2 Skill rulings

| Skill | Ruling |
|---|---|
| Hot Foot | The +2 Might applies to the user's next damaging (non-Strategic) skill, then ends. Strategic skills don't use it up. |
| Blisterblade | Counters every Harmful skill for the turn. An attacker who is already Ignited is Scorched instead. |
| Flickerflare | If the target was already Ignited, one random *other* enemy is also Ignited. |
| Heat Seeker | Deals 40 direct damage at the end of the following turn, then Scorches the target permanently. |
| Hidden Explosives, Heat Haze | Each fires once. Heat Haze triggers on **any** skill; Hidden Explosives only on Harmful ones. |
| Dragon Hatchling | HP 30 (placeholder). Its owner's Flameborn is an aura that ends when the Hatchling leaves the board. Its attack Ignites the enemy it hit; that Ignite starts ticking on the owner's next turn. |
| Cinderlings | HP 10 each (placeholder). Both count toward the 4-minion cap. |
| Flashbang | Applies **Stunned (non-Strategic)**, a base status that Swiftness also negates. |
| Ivory Step | Tagged Helpful/Strategic (self-targeted), so it can't be countered. |
| Ashen Barrier, Wraith in White | Count every active Ignite / Scorched on the board. Ashen Barrier's Shield has no stated duration, so it lasts until depleted. |
| Ring of Fire | A Harmful skill during the Taunt Ignites the bearer. If they use none, they're Scorched for 2 of their turns when the Taunt ends. |

### 11.3 Balance notes (greedy-bot simulation, 3,000 matches)

- Fire characters win about 51% of games, and characters with no element about 49%.
- **Flickerflare** won about 76% of the games it appeared in, the clear outlier. For 1 random energy with no cooldown, it added Ignite to Shot's damage and spread Ignite on re-cast. Giving Ignite a 3-turn duration barely changed this (about 75%).
- **Change (2026-09-26):** Flickerflare's cooldown went from 0 to 1. Re-simulated over 2,000 matches, it wins about 71%. That's still the top Fire skill, so it's worth revisiting (cost color, or spreading only onto un-Ignited enemies).

---

## 12. Poison

Content: `packages/content/data/poison/`. Statuses: **Toxin**, **Prey (marked)**. Condition: **prey**.

### 12.1 Mechanics

| Term | Ruling |
|---|---|
| **Toxin** | 5 Affliction damage per stack at the end of the applier's turn. Toxin from the same side merges into one stack count on the bearer. It's permanent until removed (Q16). |
| **Prey** | A **derived** state, not a status. A unit is Prey if it has more than 2 total stacks of Toxin, Weakness, Vulnerable and Confusion, **or** is below 20 HP, **or** is marked as Prey (Lunge, Mesmerizing Glare). It's defined once in `conditions.poison.yaml`, and the client shows a PREY tag on the portrait. |
| **Stances** (Viper, Cobra, Constrictor) | Convert **every** instance in the battle, including the user's own team's. Each converted effect keeps its stacks and remaining duration. The new debuff counts as applied by the user, so Immune blocks it. |

### 12.2 Skill rulings

| Skill | Ruling |
|---|---|
| Lunge | All enemies are marked Prey through the user's next turn. |
| Shed Skin | Triggers on the first direct hit only. The 3 Renew then decays normally. |
| Sting | The Toxin, Weakness or Vulnerable is picked uniformly at random. |
| Snake Pit | Triggers on **every** Strategic skill the target uses during the 3 turns. |
| Slither | Unstunnable. Its Focus has no stated duration, so it's **permanent** (Q16). |
| Unstated durations | Also permanent: Sting's debuff, Acid Orb's Mark and Vulnerable, Swamp Toxins' Confusion, Numbing Needle's debuffs, and Coil's Shield and Armor. |
| Devour | Kills characters at 14 HP or less and minions at 29 or less (the sheet says "less than 15", doubled for minions). Tagged Strategic, since it deals no damage. |
| Emerald Asp | Its skills are Serpent Fang (r, no cooldown) and Constrict (rr, no cooldown). The sheet gives no cooldowns. |
| Spriggan Harasser | Its Sting costs W, with a cooldown of 1 (Sting's own). |
| Nine Plagues | Channels for 9 of the user's turns. Using another skill with that character ends it. |
| Pounce | The random energy is added immediately, so it's usable next turn. |
| Envenom | Bypasses Invulnerable. The Prey / Invulnerable check happens before the hit. |
| Preymark | Triggers on direct damage from the applier's side, including the user. |
| Tail Lash | Its cooldown resets if any enemy it hit is Prey after the hit. |
| Moonglove Mixture | Targets **any** unit. It's tagged Helpful, so counters don't catch it even when used on an enemy. |
| Bad Stomach, Stances | Have no target, and are tagged Harmful/Strategic. |

### 12.3 Balance notes (greedy-bot simulation, 3,000 matches, elements None/Fire/Poison)

- By character element: Fire 50.0%, None 49.9%, Poison 49.5%.
- Highest Poison skills: Plague Stomp about 66%, Viper Strike about 63% (Flickerflare, after its cooldown change, about 67%).
- Lowest Poison skills: Pounce, Slither, Mesmerizing Glare, Tail Lash, Lacerate, Shed Skin and Coil, at 43–45%.
- **Watch:** Slither's permanent Focus, and permanent Weakness/Vulnerable from Sting and Numbing Needle. These stack up over long matches; permanent debuffs also make Prey easy to trigger.

---

## 13. Holy

Content: `packages/content/data/holy/`. Statuses: **Anointed**, **Condemned** (plus base **Sanctify** and **Ghosted**).

### 13.1 Mechanics

| Term | Ruling |
|---|---|
| **Anointed** | A marker that empowers Holy skills. One per unit. It's permanent unless the skill states a duration (for example, Divine Fury gives 3 turns and Holy Favor lasts through the ally's next turn). |
| **Condemned** | The next skill the bearer uses (any skill) gives them a random 1 Weakness, 1 Vulnerable or 1 Confusion, and Condemn is removed. The debuff has no stated duration, so it's permanent. It lands before that skill resolves, so a rolled Weakness reduces that skill's damage. |
| **Ghosted** | A base status: the bearer's skills Bypass (they can target and hit Invulnerable and Isolated units). |
| **"Lasts additional turns"** | Holy Nova and Saving Grace, when Anointed, repeat at the **start** of the user's next turn(s). Holy Nova repeats once; Saving Grace twice. |

### 13.2 Skill rulings

| Skill | Ruling |
|---|---|
| Divine Storm | Heals 5 per target actually damaged, counting the primary and each ally hit. |
| Zealous Rush | The user's next **Harmful** skill Sanctifies its targets for 1 turn, **after** that skill resolves, so its own hits don't trigger Sanctify. It doesn't apply to the Rush itself. |
| Retribution | For the enemy's turn, direct damage from enemies heals the user by the amount it would have dealt, after modifiers. It isn't Invisible, and it isn't a counter. |
| Sunbeam | Heals 15 only if it consumed Anointed. |
| Decree | Condemned for 2 turns. It's visible (the sheet doesn't mark it Invisible). |
| Consecration | No duration is given, so it channels until interrupted. Each end of the user's turn it hits a random **un-Sanctified** enemy for 10 (indirect) and Sanctifies them permanently. With no un-Sanctified enemies left, it does nothing. |
| Piercing Light | Deals 20 instead of 10 if the target is Condemned or Sanctified, or if the user is Anointed. The sheet's "both effects always trigger" is read as "the bonus always applies". |
| Crusade | Condemns if the target is above 75 HP **before** the hit. |
| Martyrdom | Not a counter. When the target next uses a Harmful skill, that skill's targets are permanently Anointed. Fires once. |
| Repentance | Can only target a Condemned enemy (a target requirement). |
| Sacred Lion | Roar (W) and Claws (r) have no cooldown; the sheet gives none. Roar's Sanctify is permanent. |
| Divine Blessing | Blessing from Above (W) Anoints permanently, then the minion dies. |
| Gleam | The Taunt ends when the target uses a Harmful skill. The Condemn resolves on their next skill of any kind. |
| Grand Crusader | +1 Might and +1 Armor (3 turns) per Sanctified or Condemned enemy actually hit. |

### 13.3 Balance notes (greedy-bot simulation, 3,000 matches, elements None/Fire/Poison/Holy)

- By character element: Poison 51.0%, Fire 50.2%, None 49.6%, Holy 48.1%.
- Highest Holy skills: Holy Nova about 60%, Sunbeam about 58%, Divine Storm about 56%.
- Lowest Holy skills: Angel's Grace about 37%, Cloister about 40%, Guardian Strike about 41%, Retribution and Saving Grace about 42%.
- The greedy bot undervalues setup (Anoint → payoff) and defensive skills, so Holy's support side likely plays better in human hands than these numbers suggest.

---

## 14. Ice

Content: `packages/content/data/ice/`. Statuses: **Frostbitten**, **Chilled**, **Numb** (the three "Frost debuffs"), and **Frostborn**.

### 14.1 Mechanics

| Term | Ruling |
|---|---|
| **Frostbitten** | Can't use **Harmful Strategic** skills. Damaging skills and Helpful skills are still allowed. |
| **Chilled** | Skill costs can't be reduced (Focus and other cost reductions stop working; increases still apply). |
| **Numb** | Can't apply Buffs to anyone, **including themselves**. |
| **Frostborn** | Immune to Debuffs applied by units that are Numb or Chilled. Units that are Frostbitten can't target it and can't damage it at all, directly or indirectly. Bypass ignores the latter. Implemented as two generic modifiers, `immuneToDebuffsFrom` and `invulnerableTo`, keyed on what the **source** carries. |
| **"No Buffs"** | "Targets with no Buffs" means the target carries no effect of kind Buff. |

### 14.2 Skill rulings

| Skill | Ruling |
|---|---|
| Absolute Zero | Hits every **character** on both sides with Swiftness: removes all their Swiftness, then Stuns them for 1 turn. |
| Comet Shard | Against a Chilled target it deals its 50 Piercing immediately, not delayed or channeled. Otherwise it behaves like Snipe. |
| Frost Snare | Fires once. The 2-turn Stun covers the target's next 2 turns. |
| Glissade | Applies the Stun first, then Invulnerable and Immune, so Immune doesn't block the user's own Stun. All last through the user's next turn, so the user can't act next turn. |
| Blizzard | No duration is given, so it channels until interrupted. It hits the remembered target, or all enemies while the user is Frostborn. Tick damage is indirect. |
| Shardstorm | Only hits enemies that are Frostbitten; it's usable even if none are. |
| Boreal Dance | 10 damage per Frost debuff on each enemy. Enemies with none aren't hit. |
| Glacial Sweep | If the primary target had a Frost debuff **before** the hit, a random other enemy also takes 25. |
| Frost Giant | Frostborn for (missing HP ÷ 15, rounded down) turns. Under 15 missing HP, nothing happens. |
| Ice Bear, Icy Familiar skills | No cooldowns are given, so none. Frosty Breath's Chill covers the enemy's next turn. |

### 14.3 Balance notes (greedy-bot simulation, 3,000 matches, five element pools)

- By character element: Poison 52.3%, Fire 50.9%, None 49.5%, Ice 49.1%, Holy 46.1%.
- **Glacial Burst** is about 72%, the clear Ice outlier. It deals 30 to all enemies, or 40 to any without a Buff, which early on is nearly everyone; base Blast deals 35. Candidate fixes: raise its cost, or make the bonus +5.
- Other strong Ice skills: Ice Bear about 60%. Weakest: Cold Shoulder about 37%, Boreal Dance about 38%, Flash Freeze about 40%.

### 14.4 Engine fix found while adding Ice

When a match ended partway through the end-of-turn expiry pass, the remaining expired effects were left on the board with 0 turns remaining. Expired effects are now always cleared; once the match is over, no further expiry payloads run.

## 15. Water

Content: `packages/content/data/water/`. Themes are Healing (Renew), Disruption (Confusion, stun extension) and Tempo (cooldown cuts). Water adds one status, **Flow**, and uses the base **Renew**.

### 15.1 Mechanics

| Term | Ruling |
|---|---|
| **Flow** | The bearer's skills ignore counters and reflects, the same as if every skill were Uncounterable. It's unique (it doesn't stack), and permanent unless the skill gives a duration. Implemented as the `ignoreCounters` modifier. |
| **Renew** | A base status: at the end of the applier's turn it heals 5 per stack, then loses 1 stack. Several Water skills read or strip Renew stacks. |
| **"Requires Flow"** | The skill can't be queued unless the user has Flow, and it fails (no cooldown, no refund) if the user lost Flow before it resolves. This uses the new generic `requires` condition on skills. |
| **Extending Stuns** | "Extends Stuns by 1 turn" adds 2 internal ticks (one full round) to every Stun effect on the target, including non-Strategic stuns. This uses the new `extendEffects` op. |

### 15.2 Skill rulings

| Skill | Ruling |
|---|---|
| Waterfall | Reduces every **other** skill of the user by 1 remaining cooldown; Waterfall's own new cooldown is untouched. |
| Surge | The user gets a one-shot Buff: the **next** Renew they apply (to anyone) gets +2 stacks. The Buff is then used up. Surge's own 2 Renew is applied before the Buff exists. |
| Riverbend | Counters Harmful **Strategic** skills used on the user for 1 turn. Every counter grants Flow. Non-Strategic attacks go through. |
| Coordinated Shot | Checks Mark **before** the hit. |
| Tidal Arrow | Works like Snipe (delayed, interruptible, hidden target), but only with Flow. |
| Whirlpool Trap | For 2 turns, every Strategic skill the target uses (Harmful or Helpful) gives them 1 Confusion. It's visible. |
| Rainbow Scale Fish | Shimmer has no cooldown. It checks the ally's Renew after adding its own 2, so an ally with 1 or more Renew gets Flow. |
| Drink Deeply | Removes Renew from **every** allied unit, including minions and the target, then heals the target 5 per stack removed. |
| Water Elemental | Lasts 3 turns. Lashing Water is free and Uncounterable. |
| Call Rain | The channel ticks at the end of the user's turns. Ticks are indirect. |
| Drown / Undertow | Undertow checks for a Stun before the hit: if there is one, it extends it; otherwise it applies a 1-turn Stun. Drown always extends any Stun present. |
| Dunk | Invisible. Counters the target's **Helpful** skills for 1 turn and gives 1 Confusion per counter. It's our first Harmful counter that matches Helpful skills (interceptors now filter by `harmful` and `strategic`). |
| Aqua Ring | For 2 turns, any unit on the user's side that directly damages the ringed enemy gains Flow for 3 turns. Aqua Ring's own hit comes before the ring, so it doesn't count. |
| Whale Call | Tagged Strategic on the sheet. Its conditional Affliction damage is direct, so it triggers the "Strategic but deals direct damage" lint warning. That's intentional. The fresh Vulnerable is applied first, so Stunned or Taunted enemies take 20. |
| Tidal Pull | Also leaves a permanent, unique watcher on the user: whenever the user **gains** Flow, Tidal Pull's cooldown resets. Refreshing a Flow the user already has also counts. |

### 15.3 Balance notes (greedy-bot simulation, 3,000 matches, six element pools)

- By character element: Poison 51.2%, Fire 51.0%, None 49.8%, Holy 48.8%, **Water 48.8%**, Ice 47.9%.
- The strongest Water skills are **Whale Call** (about 61%) and **Flowing Fist** (about 61%, a cd-0 20-damage hit plus Renew that beats base Strike). Waterfall and Undertow are both about 58%.
- The weakest: Drink Deeply (about 39%), Deluge (about 40%; Flow is rarely up when the bot wants it), Shell Knife, Water Elemental and Dive (about 44%).
- Flickerflare (about 72%) and Glacial Burst (about 68%) remain the top outliers overall.

### 15.4 Engine additions for Water

- Generic primitives: the `ignoreCounters` and `bonusStacksOnApply` modifiers; the skill-level `requires` condition; and the `adjustCooldowns` (with `exceptCurrent`), `extendEffects` and `resetCooldown {skill}` ops.
- Also new: the `randomAlly` selector, the `totalStacks` value, and the `effectGained` trigger with an `effect` filter.
- Counter and reflect interceptors now match by `when.harmful` (default: Harmful only) and `when.strategic`.

## 16. Unholy

Content: `packages/content/data/unholy/`. Themes are Kiss/Kill, Health manipulation and Debuffs. Statuses: **Horrified**, **Immortal**, **Soul Fragment** and **Lifesteal**.

### 16.1 Mechanics

| Term | Ruling |
|---|---|
| **Horrified** | Can't gain Buffs from any source, including itself (`immuneTo: Buff`). Existing Buffs stay. |
| **Immortal** | Health can't be reduced below 5; HP already below 5 doesn't drop further. It uses the new `hpFloor` modifier. A direct `kill` still kills. |
| **"Undying"** | Used by Undying Fury and Grave Step, but the sheet never defines it. **Read as Immortal.** |
| **Soul Fragment** | A Buff that stacks by merging and is permanent (Q16). Each stack gives +5 direct damage, the same as 1 Might. Because it's a Buff, a Horrified unit can't gain fragments. |
| **"Drain a Soul Fragment from X"** | The user gains 1 Soul Fragment; X loses nothing and needn't have any. |
| **Consuming fragments** | Happens **before** the damage the fragments pay for, so consumed fragments no longer add Might to that hit. |
| **Lifesteal** | The bearer heals for Health it removes from **another character**. Damage absorbed by Shield doesn't count, and neither does damage to minions or to itself. Any damage type, direct or not. It uses the new `lifesteal` modifier. |
| **Draining allies** | Misery's drain is indirect Affliction, so Armor, Shield, Might and Weakness don't change it. Consume Lesser's and Oathbreaker Strike's ally damage are ordinary direct hits. |

### 16.2 Skill rulings

| Skill | Ruling |
|---|---|
| Wraithwalk | Leaves a one-shot Buff: the user's next Harmful skill (not Wraithwalk itself) drains a fragment after it resolves. A countered skill doesn't use it up. |
| Spiteful Retort | Counters Harmful skills used on the user for 1 turn, Horrifying each countered attacker for 2 turns. |
| Undying Fury | Consumes all fragments, then deals 10 to a random enemy once per fragment (re-rolled each time), then Immortal for that many turns. With 0 fragments it does nothing. |
| Soul Lance | Like Snipe. After the 40 lands, it drains a fragment if the target has 49 or less HP, including when the hit killed it. |
| Soul Shackle | Sheet typo fixed (GDD §14): 1 turn, Invisible, fires once. It fires on use, so its Weakness already weakens the skill that triggered it. |
| Hellhound | Jaws of Hell is a channel: 10 Affliction to the chosen enemy at the end of each Hellhound turn until it's interrupted, including by the Hellhound using Jaws again. |
| Drain Soul | Checks Horrified **before** the hit. Gives 2 fragments against a Horrified target. |
| Drain Life | Channels until interrupted, with no duration: 10 to the target and 10 healing to the user each turn. The target carries a linked **Drained** mark that ends with the channel. It uses the new `linkTo` on `apply`. If the target dies from **any** source while marked, the user gains a fragment. |
| Blighted Dagger | Checks for 70+ HP **before** the hit. |
| Lay Waste | Checks for any Buff **after** the hit; Shield counts. |
| Mirage of Nightmares | Invisible. Counters both Harmful and Helpful Strategic skills. On each counter the caster gets Untargetable for 1 turn, plus 1 Might and 1 Swiftness. The Might and Swiftness have no duration given, so they're permanent (Q16). |
| Cripple | Permanent Vulnerable, plus a permanent Weakness if the target is Horrified. It doesn't stun, despite the archetype. |
| Grisly Spectacle | Extends **every** Horrified effect on the board by 1 turn. The user's Confusion lasts through their own next turn (`ownTurns 1`), and each use adds another instance. |
| Consume Lesser | Targets another ally, never the user (via the new `isActor` condition). |
| Cause Fear | Horrified only until the end of the current turn. Queued skills resolve at end of turn, so it only matters for skills queued **after** it that same turn (e.g. Cause Fear → Witchblade for 35). |
| Soul Sickness | The mark lasts 1 turn. Any unit on the caster's side that damages the target (direct or not) gains a fragment. The caster's own opening hit doesn't count. |
| Oathbreaker Strike | Read literally: 25 Piercing to the target, then another 10 to the target and 10 to each of the user's allies (not the user). |
| Soulshriek | Consumes 1 fragment if the user has any. With one, it deals 30 and Horrifies for 2 turns. |
| Misery | Drains 10 from each **other** ally. The Shield is 20 plus the Health actually drained, and permanent until depleted (no duration given). |
| Soul Colossus | Consumes all fragments and heals 5 per fragment, then gives 2 Armor and Immortal for that many turns. With 0 fragments it does nothing. |

### 16.3 Balance notes (greedy-bot simulation, 3,000 matches, seven element pools)

- By character element: Poison 51.4%, Fire 51.0%, None 51.0%, Holy 49.3%, Water 49.0%, Ice 47.9%, **Unholy 46.2%**.
- Strongest Unholy skills: Blighted Dagger (about 63%, a free-cooldown r-cost 15 with a fragment most of the time), Hellhound (about 60%), Soul Lance (about 59%).
- Weakest: Consume Lesser (about 26%), Cause Fear (about 33%), Vampirism (about 34%), Unrelenting Horror and Misery (about 37%).
  - These all rely on sequencing (same-turn Horrify combos) or on self-harm paying off later. The greedy bot can't evaluate either, so these numbers understate them.
  - The bot was fixed to score damage to its own side as negative. Before that, it spammed Consume Lesser (16%).

### 16.4 Engine additions for Unholy

- Modifiers: `hpFloor` and `lifesteal`.
- Ops: `repeat {times, do}` and `removeStacks {from, effect, amount}`.
- An `isActor` condition.
- `linkTo` on `apply`: the new effect ends when the actor's named effect ends, via cascading removal in `removeEffect`.

## 17. Lightning

Content: `packages/content/data/lightning/`. Themes are Resource management, Target-chaining and Consistency. Statuses: **Charged**, **Sapped**, **Stormborn** and **Conduit**.

### 17.1 Mechanics

| Term | Ruling |
|---|---|
| **Charge / Charged** | "Charge" on the sheet means stacks of **Charged**. "Is Charged" or "has Charge" means at least 1 stack. It's a Buff that stacks by merging, is capped at **3** (new `maxStacks`), and has no duration: it lasts until spent. |
| **Charged at 3** | At the start of the owner's next turn (their energy generation), they get **+1 energy**. Then all that unit's Charge is removed (GDD §14: "removed after triggering"). It uses the new `energyGain {atStacks}` modifier. Only characters generate energy, so Charge on a minion never converts. |
| **Sapped** | A Debuff that works like Charge in reverse: capped at 3, no duration. At 3, the owner generates **1 less** energy on their next turn, then it's removed. "Saps" means +1 Sapped. |
| **Stormborn** | +1 Charge each time the bearer deals damage to another unit or receives damage. Only hits that actually do something count (more than 0 after mitigation, including Shield-absorbed). It uses the new `dealtDamage` trigger. |
| **Conduit** | When the bearer damages an enemy, it takes **all** of that enemy's Charge. When a Charged ally uses a Helpful skill on the bearer, all the ally's Charge moves to the bearer. Both respect the cap of 3. The transfer uses the new non-intercepting `skillTargeted` trigger, which fires after the skill resolves, only for effects that existed before it (so Overclock doesn't pull the caster's Charge into its own target). |
| **Order** | Skills that "consume Charge for X" consume it before resolving X. Skills that only read Charge (Jolt, Defibrillate, Lightning Cage) don't consume it. |

### 17.2 Skill rulings

| Skill | Ruling |
|---|---|
| Static Slam | Checks Charged before the hit (the hit itself can give Stormborn Charge). |
| Feedback Loop | Visible (the sheet doesn't say Invisible). Counters once, then consumes all the user's Charge and lowers Feedback Loop's own cooldown by 1 per Charge. It uses `adjustCooldowns` with the new `skill` filter. |
| Zap | Base cost I, or r while the user has Charge. It uses the new `altCost` on skills, applied at queue time (GDD §3.4) and shown on the tile. |
| Particle Beam | Like Snipe, but not hidden-target (the sheet doesn't say so). When it fires, it hits the target plus every enemy Sapped **at that moment**, each once. It uses the new `{ filter, where, exclude }` selector. |
| Tesla Coil | Invisible trap, 1 turn, fires once: 15 indirect damage and +1 Sapped. |
| Blink | Can only target a Sapped enemy, so it's unusable without one. |
| Static Elemental | If the summoner has Charge, 1 Charge becomes the Elemental's permanent Might (`onSummon` + the Unholy `removeStacks` op). |
| Lightningrod | Channels until interrupted. It grants a Stormborn linked to the channel (Unholy's `linkTo`). If the user already has Stormborn (e.g. Overcharge), that one is kept with its own duration. |
| Stun Baton | Checks for 80+ HP **before** the hit and 40 or less HP **after** it. |
| Hologram | Harmful, Strategic, and targets all enemies. Only enemies **already Sapped** when it resolves get the (visible) Hologram mark. For 1 turn their Harmful skills are countered, and each counter makes the caster Untargetable for 1 turn. |
| System Shock | Stuns non-Strategic skills for 1 turn, or 2 if the target was Sapped before the hit. |
| Signal Boost | 25 to the target, then 10 per Charge to every Charged ally, which can include the target. Charge isn't consumed. |
| Arc | 10 to the target, then 10 to every **other** Marked enemy (Mark's +10 applies), then Marks the target for 1 turn. |
| Lightning Cage | A Shield of 20 + 10 per current Charge for 1 turn. Every hit it absorbs gives +1 Charge, including the hit that breaks it. It uses the new `shieldDamaged` trigger. |
| Aggro Signal | Uses Reflect: the target's next Harmful skill within 1 turn is countered and turned back on its user, who is also Intimidated for 1 turn. Fires once. |
| EXO-Armor | Consumes all Charge. Per Charge: 1 Armor and 1 Swiftness, both permanent (Q16). Then Stormborn for 3 turns. |
| Storm Hawk, Static Elemental Zap | No cooldowns given, so none. Glowing Down can target any ally, including a minion (whose Charge never turns into energy). |

### 17.3 Balance notes (greedy-bot simulation, 3,000 matches, eight element pools)

- By character element: Poison 52.4%, Fire 51.6%, None 50.6%, Water 49.9%, Holy 48.5%, Ice 48.3%, Unholy 48.2%, **Lightning 46.9%**.
- Strongest Lightning skills: Stun Baton (about 59%), Overcharge (about 57%), Jolt (about 56%), Malectrocute (about 55%).
- Weakest: Signal Boost (about 33%), Apply Polarity (about 36%), Static Burst (about 36%), Power Drain (about 37%), Arc and Three Storm Breaths (about 39%).
  - The greedy bot doesn't value building Charge or Sapped toward the 3-stack energy swing, so these probably understate the element.
  - The energy swing itself is the element's main payoff and should be watched in human playtests.

### 17.4 Engine additions for Lightning

- Stacks and energy: `maxStacks` on effects, and `energyGain {atStacks}` (fires at the threshold, then removes the effect).
- Conditional cost: `altCost` on skills.
- Triggers: `dealtDamage` and `shieldDamaged` (a depleted Shield's own trigger still runs), plus non-intercepting `skillTargeted` with `when.side`.
- Selectors and ops: the `{ filter, where, exclude }` selector, and `adjustCooldowns` with `skill` and a computed `by`.

## 18. Wind

Content: `packages/content/data/wind/`. Themes are Reactivity, Immunity and Speed. Statuses: **Rushing** and **Leaping**. **Immobile** is a named condition, and a new base status **Stunned (Strategic)** (`stun_s`) was added.

### 18.1 Mechanics

| Term | Ruling |
|---|---|
| **Rushing** | A Buff that doesn't stack and has no duration. When gained, and at the start of each of the bearer's turns, it grants 1 Swiftness if they have none and 1 Focus if they have none. That Focus lasts until the bearer's next skill, so it's a steady −1 GEN per turn. Rushing ends at the end of a bearer's turn in which they used no skill. The turn it's gained never ends it, even if an ally granted it. "A new skill" is read as **any** skill used that turn. |
| **Leap** | "X Leaps" means Invulnerable for 1 turn, plus **Leaping**: +5 to direct damage. Leaping lasts until one of the bearer's skills has dealt direct damage and resolved; every hit of that skill gets the +5. A new Leap replaces the old Leaping, so "Leap again" (Air Bullet) spends one and grants a fresh one. |
| **Mobility buffs** | Swiftness, Rushing and Leaping. "Removes all Mobility buffs" (Sap Speed, Headwind) removes all three. Leap's Invulnerable isn't a mobility buff and stays. |
| **Immobile** | A **character** (never a minion) with no Charge, Maneuver, Mislead or Dance skill and no mobility buff. It's computed live, like Poison's Prey. It uses the new `hasSkill` condition, and the client shows an **IMMOBILE** badge while any Wind skill is in play. |
| **Stunned (Strategic)** | New base status for "stuns their Strategic skills" (Buffet). Swiftness negates it like the other stuns. Water's stun checks (Drown, Undertow, Whale Call) now count it too. |

### 18.2 Skill rulings

| Skill | Ruling |
|---|---|
| Leaping Strike, Spiral Crash, Air Bullet | Check Leaping **before** the hit. Spiral Crash's +10 AoE also hits the primary target. Air Bullet's Leaping bonus is 5 more on top of Leaping's own +5. |
| Launch | Free (no cost). The user begins Rushing. |
| Zephyr Blade | If countered (or reflected), the counterer takes 25 Piercing. This uses the new skill-level `onCountered` ops, which run even if the counter killed the user. |
| Chainbreaker | Usable while Stunned. Removes every Debuff (new `removeKind` op), then Immune for 2 turns. |
| Elegant Sweep | A Snipe-like channel: 25 Piercing to every enemy at the end of the following turn. |
| Float Noose | Visible (the sheet doesn't say Invisible). For 2 turns, **every** skill the target uses Isolates them for 1 turn and deals 10 indirect Piercing. |
| Grand Eagle | Soar makes the Eagle and the target ally Leap. Neither minion skill has a cooldown. |
| Summon Wind Sprite | Two Sprites for 3 turns. A countered Bother Stuns the counterer for 1 turn. |
| Vortex | The redesigned text (GDD §14.2). The extra turn is added **once**, the first time the user is Leaping or Rushing at a tick, matching base Channel's single extension. |
| Sonic Thrust | If the user isn't Rushing, they're Stunned through their own next turn (`ownTurns 1`). Swiftness can negate it. |
| Wind Step | Visible. For 1 turn, a Harmful skill from the target Marks them (1 turn) and the caster begins Rushing. It isn't a counter. |
| Top Speed | Might and Ghosted for 3 turns, and Rushing (no duration). |
| Invigorating Breeze | Checks for 61+ HP **after** the heal. |
| Uplifting Verse | "All units in the game" includes enemies and minions. Everyone gets Leaping and 1 turn of Invulnerable. |
| Falling Slam | Costs A instead of Ar while Leaping or Rushing (Lightning's `altCost`). Chilled can't stop this, since it's a different base cost, not a reduction. |
| Echoing Voice | Every unit in the game, enemies included, gains 1 Swiftness. |
| Slipstream | 15 Shield, or 30 while Rushing. No duration is given, so it lasts until depleted. |
| Piercing Cry | Taunt for 1 turn, or 3 against an Immobile target. |
| Headwind | The Weakness has no duration, so it's permanent (Q16). |
| Djinnform | 15 Shield and Immune for 3 turns, then the user Leaps. |

### 18.3 Balance notes (greedy-bot simulation, 3,000 matches, nine element pools)

- By character element: Poison 53.3%, Fire 52.2%, None 49.8%, Ice 49.3%, Water 48.9%, Holy 48.5%, Lightning 48.0%, **Wind 47.9%**, Unholy 46.6%.
- Strongest Wind skills: Summon Wind Sprite (about 61%; two free 5-Piercing pokes per turn) and Elegant Sweep (about 58%).
- Weakest: Falling Slam (about 34%; only 10 AoE), Feathermark (about 37%), Piercing Cry (about 39%), Airknife and Zephyr Blade (about 40%).
  - Rushing upkeep and Leap timing are sequencing plays the greedy bot doesn't plan for.

### 18.4 Engine additions for Wind

- Skill-level `onCountered` ops.
- Ops: `removeKind`, and `setFlag` with `value` (to clear a flag).
- The `hasSkill` condition.
- The base `stun_s` status.

## 19. Shadow

Content: `packages/content/data/shadow/`. Themes are Untargetability, Deception and Interference. Statuses: **Stealth** and **Blinded**. **Sleep** is a new base status, because Holy's Chastise is the same status (GDD §5.3). Ghosted and Isolated were already base statuses.

### 19.1 Mechanics

| Term | Ruling |
|---|---|
| **Stealth** | Untargetable by enemies (Bypass doesn't pierce it). Skills grant it for 2 turns, i.e. through the enemy's second turn. It ends once the bearer uses a skill that isn't Stealthy, **after** that skill resolves (whether it resolves or is countered), so "if the user is Stealthed" checks in that skill still see it. It uses the new effect flag `stealth`. |
| **Stealthy** | A skill tag. Using a Stealthy skill (or any skill under Long Shadow's buff) keeps Stealth and adds 1 turn to it. A skill that grants Stealth always grants a fresh one (the `gain_stealth` macro), so non-Stealthy Stealth-granting skills don't cancel their own Stealth. |
| **R6 visibility** | When a Stealthed unit uses a Stealthy skill, the opponent's `skillUsed` event is redacted to "A Stealthed unit acted", with no actor, skill or targets. **Known gap:** that skill's damage and effect events, and the enemy skill tile's cooldown, still reveal the actor. Full redaction belongs with the server work (Phase 5). |
| **Blinded** | When a Blinded unit's single-target skill (enemy, ally or any) resolves, its primary target is re-rolled uniformly among **all** legal targets for that skill. That includes the one they chose, and still respects Taunt, Untargetable and Isolated. AoE and self skills are unaffected. It uses the new `randomPrimaryTarget` modifier. |
| **Sleep** | Can't use skills. It ends when the bearer takes damage (any amount above 0, including Shield-absorbed), except damage marked `wakes: false` (Dream Seeker). A new Sleep interrupts channels like any stun, and Swiftness negates it like the other stuns. |

### 19.2 Skill rulings

| Skill | Ruling |
|---|---|
| Black Axe | The user gains Stealth if the target is dead after the hit. |
| Shadow Crash | Counts every Stealthed ally (including the user), removes all their Stealth, then adds +10 per Stealth to **both** the 10 hit and each 5 splash. |
| Long Shadow | Stealthy. It gives a one-shot buff that makes the user's next skill count as Stealthy. |
| Mirage Blade | Invisible. Counters the first Harmful skill used on the user within 1 turn. The Focus has no duration, so it's permanent (Q16). |
| Shadow Spine | Counts Blinded, Isolated and Sleep **before** the first hit, then deals that many extra 5-Piercing hits. The first hit wakes the target, but the counted hits still land. |
| Dream Seeker | Not Channeled, since the sheet doesn't say so, and so not interruptible. 35 damage a turn later with Bypass, and it doesn't wake a Sleeping target. |
| Dream Chains | Visible. If the target uses no skill during their next turn, they take 15 indirect Affliction and fall Asleep for 2 turns. |
| Spirit Raven | Fel Swoop heals the Raven itself. Blackwing's Taunt points at the Raven. |
| Wave of Darkness | **Changed at the user's request (2026-09-26):** the Confusion lasts 1 turn. The sheet gives no duration, which made it permanent under Q16 and an 84% outlier. |
| Drink Darkness | 5 Affliction to all enemies. Each Blinded enemy then loses Blind and takes 10 more Affliction. |
| Nightsong | Channel for 3 turns. If it runs to completion (not interrupted), every living enemy falls Asleep for 2 turns, after the final tick. |
| Hall of Phantoms | Always grants a fresh Stealth. If the user was already Stealthed, they also get Ghosted, Immune and 1 Focus for 2 turns. |
| Touch of Slumber | Puts the healed **ally** to Sleep, as written. |
| Shadowbrand | Used while Stealthed, its cooldown resets immediately. |
| Veiled Guard | +1 permanent Armor. At 3 or more total Armor stacks, the user gains a fresh Stealth. |
| Shadow Mockery | Summons a 5 HP minion with no skills (permanent until killed). The target is Taunted **to the minion** for 1 turn, via the new `from` on `apply` and the `lastSummoned` selector. If the minion cap blocks the summon, there's no Taunt. |
| Faceless One | Uses the GDD §14.2 text: for 3 turns the user has 1 Armor, and all enemies are Taunted by the user and Isolated. |

### 19.3 Balance notes (greedy-bot simulation, 3,000 matches, ten element pools)

- By character element: Fire 52.4%, Poison 51.7%, Ice 50.1%, Lightning 50.1%, None 49.9%, Wind 49.9%, Holy 49.0%, **Shadow 48.4%**, Unholy 47.5%, Water 45.8%.
  - With 10 pools, each skill now appears in only about 110 games, so per-skill numbers are noisy (±5%).
- **Wave of Darkness** was about 84% while its Confusion was permanent (Q16), because stacking Confusion quickly made enemy skills unaffordable. With a 1-turn Confusion, it's about 64%, and Shadow overall is about 47%.
- Other strong Shadow skills: Shadow Mockery (about 61%) and Spirit Raven (about 59%).
- Weakest: Hall of Phantoms (about 32%), Blinding Powder (about 34%), Touch of Slumber (about 35%) and Nightwrap (about 36%). The bot can't exploit Stealth timing or plan around Blind.

### 19.4 Engine additions for Shadow

- The `stealth` effect flag (Stealth upkeep lives in the pipeline), plus the `nextSkillStealthy` and `randomPrimaryTarget` modifiers.
- Sleep support: `wakes` on damage ops and on `damaged` triggers.
- Taunting to a summoned minion: `from` on `apply`, and the `lastSummoned` selector. Summon ops now return the unit.
- The `stealthFrom` redaction on `skillUsed` events.

## 20. Earth

Content: `packages/content/data/earth/`. Themes are Armor, Healing and Minions. There are no new statuses. Earth's identity is its minions: **Boulder** (45 HP, no skills), **Seedling** (15 HP, Channel Earth), **Forest Stalker** (50 HP, counts as a Seedling) and **Worldsprout** (35 HP). The minion cap (4 per side, GDD §3.2) applies throughout, and summons beyond it fail silently.

### 20.1 Mechanics

| Term | Ruling |
|---|---|
| **Minion types** | Minions can carry extra `tags`. Forest Stalker is tagged `seedling`, so "Seedling" everywhere includes it. The new `minion {unit, types}` condition matches by minion id or tag. |
| **Channel Growth** | A macro, not a status. Every allied Seedling gains +10 **max** HP (new `addMaxHp` op), then heals 10. |
| **Channel Earth** | A Seedling skill (r, no cooldown). The Seedling's **summoner** gains 1 Might and 1 Armor, both **permanent** since there's no duration (Q16). |
| **Launching a Boulder** | The Boulder deals its current HP to a random enemy **as the Boulder** (new `from` on damage ops), so "damage from a Boulder" effects see it. The Boulder is then destroyed. It's direct damage, but it doesn't benefit from the user's Might. |

### 20.2 Skill rulings

| Skill | Ruling |
|---|---|
| Worldfist, Worldquake | Count every allied minion. Worldquake's discount is 1 GEN per minion, applied like Focus (new skill-level `costAdjust`), so Chilled blocks it. |
| Shale Guard | Invisible. Counters the first Harmful skill within 1 turn and deals 10 indirect Piercing to its user. |
| Launch Stone | Targets an enemy (15 damage) **or** an allied Boulder (launched as above). No other ally or minion can be targeted. |
| Tunnelmaker | Lands in 2 turns (like a Snipe with `enemyTurns 2`). If the user has a Boulder, a random one is destroyed and it lands a turn sooner. Interruptible. |
| Boulder Trap | For 2 turns, **every** minion the target summons is destroyed on arrival, and the trapper summons a Boulder each time. It uses the new `summoned` trigger on the summoner's effects. It's visible. |
| Vine Lash | Creates a Seedling only if the user has none (Forest Stalkers count). |
| Worldmarch | Kills all allied Seedlings and summons that many Worldsprouts (up to the cap). |
| Worldcaller | Channel for 4 turns: one Worldsprout at the end of each of the user's turns. Vitality Transfer kills the Worldsprout and heals **another** ally for its HP at that moment. |
| Stonepierce | 20 against a target with Armor or any Shield with value left (new `hasShield` condition). |
| Stone Drill | +20 if the user's Armor stacks plus Might stacks total at least 3. |
| Pitfall | Visible. For 1 turn, the target's Harmful skills are countered, and each counter Stuns and Isolates them for 1 turn. |
| Earthwrap | The enemy's 25 Shield is permanent until depleted (Q16). It's a 2-turn Stun. |
| Landslide | Each use adds a 10-point "Landslide" Shield. If one was already up, the user also creates a Boulder. |
| Infuse Earth | Free, no cooldown. Randomly 1 Might or 1 Armor, both permanent. |
| Worldmute | Targets an **ally** (intentional, GDD §14.2). For each Might stack on that ally, a random enemy (re-rolled each time) gains 1 permanent Weakness. |
| Earth Pillar | For 1 turn, damage from a Boulder (a launched one) Stuns the target for 1 turn. |
| Vine Whirl | 5 to all enemies, then launches a random allied Boulder if there is one. |
| Awakener's Roar | Every allied Boulder gains 1 permanent Armor and heals to full. |
| Rampart | With any Shield up, every Shield effect on the user is doubled (new `scaleShields` op). Otherwise it's a new 30 Shield, permanent until depleted. |
| Ancient Grudge | A permanent Taunt (inline, forcing targeting onto the user). Using it again moves the grudge: it's removed from all enemies first. |
| Treant Form | Counted when used: Might equal to the Seedling count and a Shield of 5 per Boulder, both for 4 turns. There's no Shield with 0 Boulders. |

### 20.3 Balance notes (greedy-bot simulation, 4,000 matches, eleven element pools)

- By character element: Poison 53.3%, Fire 51.7%, Water 51.4%, None 50.9%, **Earth 50.1%**, Holy 50.0%, Wind 47.5%, Ice 46.9%, Shadow 46.9%, Unholy 46.3%, Lightning 46.1%.
- Strongest Earth skills: Vine Lash (about 72%), Forest Stalker (about 69%), Nature's Wrath (about 64%) and Sprout Seedling (about 62%). Seedlings' Channel Earth grants **permanent** Might and Armor for r each turn, which snowballs.
  - **Candidate fix:** give Channel Earth's Might and Armor a duration, or a cooldown of 1.
- Weakest: Vine Whirl (about 34%), Tunnelmaker (about 39%), Rampart (about 40%) and Ancient Grudge (about 41%).

### 20.4 Engine additions for Earth

- Minions: minion `tags`, the `summoned` trigger, and summon ops that return the unit.
- Conditions and values: `minion`, `isEnemy` and `hasShield` conditions, and the `hp` value.
- Ops: `from` on damage ops, `addMaxHp`, and `scaleShields`.
- Costs: skill-level `costAdjust`.

## 21. Fusion kits

Two infusions on a skill make the pair's fusion element (GDD §7.3), and a fusion skill is its own variant, `<base>.<fusion>` (`strike.dragon`). The kits come from the "Fusion Spec Kits" design doc (its site mirrors it). Content lives in `packages/content/data/fusions/<fusion>/`. These are first implementations, built for coverage: each kit's rulings and simplifications are listed here, and its behavior tests come in a later pass. `fusion-smoke.test.ts` casts every fusion skill and plays on to prove it runs.

### 21.0 Shared machinery

| Term | Ruling |
|---|---|
| **Fusion passives** | A fusion can list `passives` (statuses) in `fusions.yaml`. Every character with at least one of its skills carries them from the start, like equipment passives. Kits use this for their resources and rules. |
| **New targets** | `weakestAlly` (the actor's targetable character ally, or self, with the least HP), `weakestEnemy` and `strongestEnemy` (the targetable enemy character with the least or most HP). Ties go to the earliest in team order. |
| **interrupt** | A new op that ends the targets' channels, as a Stun would. |
| **costAtLeast** | Intercepting triggers can catch only skills whose listed cost totals at least this. |
| **Validation** | A skill whose element is a fusion's name is a fusion skill, not a new base element. |

### 21.1 Dragon (Fire + Fire)

| Term | Ruling |
|---|---|
| **Dragonfire** | Rides on an Ignite: a unit with Dragonfire always has an Ignite too, so every "if Ignited" check anywhere still sees it. While both are on a unit, the Ignite is silent and Dragonfire burns for 10 Affliction at the end of its applier's turn. If the Ignite is removed, the Dragonfire goes out at its next tick. Removing Dragonfire alone (Fang) leaves the Ignite. |
| **Hoard** | The passive Wyrm's Heart (every Dragon character): each time an Ignite or Dragonfire the character applied deals damage, they gain 1 Hoard (max 6, merging). This lives in Fire's `burn_aftermath` macro, which Ignite and Dragonfire run after each burn. Hoard's Armor is computed from its stacks (1 per 2; 1 per Hoard during Elder Wyrm) and only reduces Normal damage, like Armor. |
| **Breath** | A macro: the bonus is 5 × the user's Hoard, then all Hoard is removed, before the damage lands. |

| Skill | Ruling |
|---|---|
| Tail Sweep | Interrupts and gives Dragonfire to every enemy channeling at the time, not only those it hit. |
| Dragon's Descent | Until the user's next skill resolves, each Ignite they apply also gets Dragonfire. |
| Dragon's Toll | Gains Hoard equal to the countered skill's listed cost total. |
| Skyfall Breath | The circling user is Untargetable by enemies (Bypass gets through) until it lands or is interrupted. |
| Gilded Bait | The first Buff gained is ended at once. **Simplified:** the Dragonfire it gives can still be removed. |
| Burning Wake | While it lasts, the user's Ignites and Dragonfire also burn at the start of their bearer's turn. |
| Wyrmbolt | The target's Ignite (or Dragonfire) burns twice at once, each burn counting for Hoard and Flameborn. |
| Dragon Egg | The egg has a 3-turn Hatching timer. If the egg is alive when it runs out, a permanent Wyrmling appears and the egg is removed. |
| Molten Maw | **Simplified:** any indirect damage the target takes while Ignited counts as their Ignite burning. |
| Covetous Eye | Placed on every enemy. **Simplified:** each enemy's first qualifying skill is countered, not only the first one overall. The thief gains 1 energy at their next generation, and the robbed player generates 1 less at theirs. |
| Warming Wings | Each burn heals the user's ally with the least HP (the user included) for the damage dealt. |
| Hearthfire | Spends up to 3 Hoard, one at a time, for 10 healing each. |
| Dragonblood | The ally's direct damage to enemies Ignites the target (the ally is the applier), or adds Dragonfire if they're already Ignited. |
| Slag | Removes the base Armor and Shield statuses. Shields from other skills stay. |
| Pyre Brand | The Scorch and a 1-turn marker are applied together. When the marker ends, the target Explodes if still Ignited. |
| Dragon's Slumber | The user Sleeps for up to 3 turns. At the end of each of their turns while asleep, all allies heal 20. Waking ends it. |
| Wyrm's Domain | Placed on each ally. Every Harmful skill aimed at one of them by an enemy the user hasn't Taunted deals that enemy 10 damage, once per ally targeted. |
| Elder Wyrm | Hoard gives 1 Armor per stack while it lasts. |

### 21.2 Crystal (Ice + Ice)

| Term | Ruling |
|---|---|
| **Brittle** | Max 3, merging. +5 direct damage taken per stack. When a direct hit lands on a unit with 3, it Shatters them: Brittle is removed, then 20 more (indirect) damage and Shattered for 2 turns. **Simplified:** Brittle doesn't count as a Frost debuff for other kits' checks. |
| **Diamond** | New `maxHpLossPerHit` modifier: no single hit takes more than 15 HP, counted after Armor and Shield (ticks included). It tracks what it prevented in the effect's `prevented`. |

| Skill | Ruling |
|---|---|
| Faceted Hammer | Frostbitten, Chilled and Numb each end for 1 more Brittle (Brittle caps at 3). |
| Crystal Quake | The burst counts the target's Brittle after this hit adds 1. |
| Shard Rush | Frost debuffs (and Brittle) the next skill applies last 1 more turn. |
| Rime Splinter | Their Frost debuffs and Brittle are extended by a turn. **Simplified:** they can still be removed. |
| Hairline Fracture | Tops Brittle up to 3 on the target's first Harmful skill. |
| Crystal Cocoon | Counts Debuffs before removing them; Diamond for that many turns when Invulnerable ends. |
| Crystal Golem | At the start of its owner's turn, their ally (or self) with the least HP gains Diamond for 1 turn. |
| Quartz Spike | When the user's Mark is spent (consumed) within the turn, its target gains 2 Brittle. |
| Hard Freeze | Chilled → Frostbitten first; a unit that wasn't Chilled has Numb → Chilled. |
| Ice Pick | Removes Frostbitten, else Chilled, else Numb, for 10 more. |
| Price of Frost | After it counters, every enemy carries a 2-turn toll: +1 cost while Chilled. |
| Perfect Form | One effect gives +10 direct damage (2 Might) and −1 cost (1 Focus); Swiftness is separate. A hit of 25+ (HP plus Shield) removes the effect and the user's Swiftness, and Stuns them for 1 turn. |
| Faceted Ward | New `maxHpLossPerTurn` modifier: at most 25 HP lost per turn, ticks included. |
| Diamond Skin | Its own Diamond; on expiry it heals half of what it prevented, up to 30. |
| Fault Lines | Every skill the target uses gives them 1 Brittle. |
| Cold Clarity | Enemies of the target who damage it within the turn become Frostborn for 1 turn. |
| Seeking Shards | The second hit goes to a random Frostbitten enemy (not the primary) if there is one, and Numbs them. |
| Glass Harmonic | New `removeShields` op: every Shield effect on every unit ends, then everyone is Shattered for 1 turn. |
| Latticework | The user's 30 Shield; every other ally carries a linked status (new `borrowShield` modifier), so their hits drain it after their own Shields. It ends with the Shield. |
| Flawless Challenge | Diamond against every hit. **Simplified:** each capped hit from an enemy the user Taunted extends that Taunt by 1 turn (it doesn't restrict the cap to them). |
| Diamond Colossus | Diamond and Immune; on expiry every enemy gains 2 Brittle. |

Engine additions: `maxHpLossPerHit`, `maxHpLossPerTurn`, `borrowShield` modifiers; `effectData` and `kindCount` values; the `removeShields` op; and `damaged` triggers now carry the hit's size as `eventAmount`.

### 21.3 Ocean (Water + Water)

| Term | Ruling |
|---|---|
| **Crest and Trough** | The engine counts each unit's uses of each skill (`uses:<skill>` counters, countered uses included). The new `crest` condition is true when the count so far is even, so the first use is the Crest form and they alternate. Minions count their own uses (Kraken). **Not yet shown in the client.** |
| **Brimming** | Base Renew now reports its overflow (new `lastOverheal` value). On a Brimming unit, the overflow goes into a single Brimming Shield (new `growShield` op), capped at 30. Chorus of Tides uses the same Shield. |

| Skill | Ruling |
|---|---|
| Swell | The user stores the turn of their last Trough (new `setCounter` op and `counter` / `turn` values). Crest adds 5 per own turn since then (or since the start), up to 20. Trough's Flow lasts until the end of the user's next turn. |
| Relentless Surf | Uses `extendEffects` with an `onceKey`, so each Stunned enemy's Stuns grow only once. |
| Spindrift | Already Brimming: spends up to 20 of the Brimming Shield as extra damage, instead of gaining Renew and Brimming. |
| Undercurrent | Trough: each time the target heals someone, the user's ally with the least HP heals as much. |
| Brine Bolt | The first direct hit from the user's side that finds the Mark gone (spent) gives its dealer 2 Renew and Brimming. |
| Ebbing Toll | **Simplified:** each skill the target uses while Confused heals the user 10 per Confusion stack, as if they paid it. |
| Jellyfish Bloom | For 3 turns, any enemy who kills one of the user's Jellyfish (the `died` signal) is Stunned for 1 turn. |
| Slack Water | Allies carry a linked status while it channels; base Renew skips its stack loss on them. |
| Breaker Swell | The user's Stun lasts through their next turn. |
| Siren's Lure | Crest counters Harmful skills; Trough counters Helpful ones. |
| Maelstrom | Trough: Stunned enemies' Stuns (any kind) grow by 1 turn; the rest gain 1 Confusion for 2 turns. |
| Tidepool | Overflow becomes 2 Renew per full 10. |
| Brine Haze | Allies carry a status that adds 1 Confusion (2 turns) to the target each time they gain Renew. |
| Crosscurrent | Trough uses the new `shareEffects` op: each target gains copies of the other's Debuffs as they stood. |
| Whalesong | New `reveal` op: every hidden effect the enemies applied is revealed. For 2 turns, each effect they apply is revealed as it's made. |
| Returning Wave | When the Shield expires unbroken, what's left is split evenly, as indirect damage, among the living enemies. |
| Leviathan Form | The bite goes to the targetable enemy character with the least HP. |

### 21.4 Thunder (Lightning + Lightning)

| Term | Ruling |
|---|---|
| **Resound** | An "Echo" effect on each unit damaged, valued at half that damage rounded up to 5. It lands when it runs out, at the end of the enemy's turn, just before the user's next turn: the echo is indirect damage, and the echo's owner gains 1 Charge. |
| **Deafened** | New `muteTraps` modifier: intercepting triggers (counters, reflects) and Trap effects *applied by* the bearer don't fire. Each muted attempt broadcasts the `trapMuted` signal from the bearer. |

| Skill | Ruling |
|---|---|
| Clap | Two echoes, one before each of the user's next 2 turns. |
| Rolling Thunder | The echo also hits the target's allies. |
| Sonic Boom | **Simplified:** the next enemy skill aimed at the target (from the user's side) Deafens them for 2 turns first. |
| Storm Snare | A hidden `muteTraps` status: the target's first counter, reflect or Trap fails, and they take 25 and are Deafened for 2 turns. If it runs out unused, they're Sapped. |
| Second Flash | The engine remembers each unit's last skill slot; the new `resetCooldown` `lastUsed` clears it. |
| Thunderbird | A permanent status on the user Deafens every enemy for 1 turn when their Thunderbird dies. Wingclap's echoes give the Thunderbird the Charge. |
| Thundercrack | The direct hit that finds the Mark gone Resounds, with the echo's owner being whoever hit. |
| Skyquake | The user's Charge is spent first. Each target gets an echo before the next turn, plus one more per Charge, a turn apart. |
| Thunderhead | Strikes every unit tied for the most Charge (3, then 2, then 1); a random enemy if no one has any. |
| Drumroll | Lands only when it runs its full 3 turns: 30 to each enemy, with Resound. Interrupted, nothing lands. |
| Leaking Rend | **Simplified:** at 2 Sapped, the target generates 1 less energy and the Sapped is spent; it can still be removed. |
| Overcapacity | Charged gets a `stackCap` of 5 and pays 2 energy at 5 (instead of 1 at 3) while it lasts. |
| Rolling Hymn | Until the user's next turn, each skill an enemy uses heals all the user's allies 10. |
| Thunder Cage | Each hit on the Shield echoes half of what it absorbed back at its attacker (the `shieldDamaged` trigger now carries the amount). |
| Stormspire | New `absorbAoE` modifier: an enemy skill that targets all of the user's side is retargeted to the user alone. Splash from single-target skills isn't redirected. |

### 21.5 Cloud (Wind + Wind)

| Term | Ruling |
|---|---|
| **Drift** | A new skill tag. When a Drift skill is used, its cooldown starts and it joins the public `drifting` list (event `skillDrifting`) instead of resolving. At the start of its user's next turn it lands: it resolves through the normal skill pipeline, so counters and Traps react then. It uses the same targets if they're still valid, otherwise a random valid one. It lands even if the user is Stunned, but is lost if they died. A minion's Drift lands on its owner's next turn. |
| **Aloft** | Statuses can now `countsAs` other statuses for `has` checks: Aloft counts as Leaping (Wind's payoffs and Immobile see it). It gives +5 direct damage, isn't ended by dealing damage, and gives no Invulnerability. |

| Skill | Ruling |
|---|---|
| Anvil Cloud | A 2-turn delay on the user (not a Drift): lands just before the user's second turn from now, unless they die. |
| Rise Above | **Simplified:** at the start of each of the user's turns while it lasts, all their Debuffs drift off (including ones from before). |
| Hailfall | Hits every other unit, minions included, that isn't Leaping or Aloft. |
| Squall Line | Enemies who use a Harmful skill before it breaks are marked and take 30 Piercing; the rest take 15. |
| Overcast | Each skill the target uses adds a cloud. When it ends, the clouds drift in: 15 each, a turn later. |
| Idle Updraft | Wind's Rushing skips its idle-turn removal while the user has Idle Updraft. |
| Cirrus Bolt | Drifts with no chosen target; on landing it hits the enemy with the least HP. |
| Cloudburst | If the user was Leaping, the Leap is renewed after the hit (no new Invulnerability); otherwise they Leap. Aloft stays as it is. |
| Evaporate | The second drain is a delayed effect on the user, not a landing skill. |
| Low Ceiling | Wind's Immobile condition now also counts a unit with Low Ceiling. |
| Sleet Squall | **Simplified:** Aloft for 1 turn, matching the Stun's duration (it doesn't end early if the Stun is removed). |
| Rain Check | New `deferHits` modifier: each hit on the ally (from someone else) becomes a held hit 10 lower, landing at the end of that turn as indirect damage. |
| Lift | Removes any Taunt; a Taunt gained while Aloft is removed at once. |
| Becalmed | New `driftSkills` modifier: the target's skills Drift while it lasts. |
| Cloudbank | Leaps if the Shield is depleted while the user is Rushing. |
| Looming Cloud, Cloud Titan | Their damage drifts in as a held "Drifting Damage" effect a turn later. Cloud Titan marks the last enemy to damage the user. |

### 21.6 Evolution (Poison + Poison)

| Term | Ruling |
|---|---|
| **Evolve** | A skill's stage is its user's use count so far (the `timesUsed` value): Stage I first, II second, III from the third use on. Later stages keep earlier stages' changes. **Not yet shown in the client.** Mutant Fang cycles I → II → III → I and Stalking Mark evolves when it triggers; both keep their own counters. |
| **Engine** | New `lastAttacker` target (each unit remembers the last enemy who damaged it), `moveEffects` op, `protectEffects` modifier (listed statuses on the bearer can't be removed or reduced by other effects; they still expire), and `adaptiveHide` modifier (learned per-skill resistance kept in the unit's counters). |

| Skill | Ruling |
|---|---|
| Mutant Fang | 1 Toxin at every stage; II and III make the target's Toxin tick (indirect Affliction) once or twice now. |
| Primal Stomp | III adds 5 per Toxin on the target's allies after this spreads. |
| Scent Trail | The user's next Toxin applied to an enemy also goes to every other Prey enemy. |
| Molt | I–II react to the first direct hit within the turn; III counters the first Harmful skill instead. |
| Apex Predator | Might becomes the same stacks of Weakness for 3 turns (on everyone at I, everyone but the user from II). |
| Telltale Venom | Poison's Prey condition now also counts any enemy with Toxin while they carry Telltale Venom (until the end of the user's next turn). |
| Barbed Quill | From II, a Prey target is hit at once; III also hits every other Prey enemy. |
| Nesting Pit | Counts triggers in its stacks; II deals 10 per trigger on expiry; III Stuns if none. |
| Slough Off | II moves Toxin, III moves every Debuff, onto the last enemy who damaged the user. |
| Brood Parasite | **Simplified:** the Parasite can't be targeted by enemy skills at all; it dies when any Parasite Host dies. Feed targets the host (Affliction 10) and heals the user's weakest ally. |
| Corrosive Glob | Armor stacks become Vulnerable for 2 turns; III removes all Shields for 1 Toxin per 10. |
| Extinction Event | Hits every unit below 60 HP, the user included. |
| Plague Strain | Its stacks count the turns: II from its second tick, III from its third. |
| Opportunist | III executes Prey at or below 14 HP; otherwise I–II as written. |
| Paralytic Bite | II marks the target as Prey for the Stun's duration; III Stuns a random Prey ally of theirs when it ends. |
| Adaptive Hide | While it lasts, each enemy skill that directly damages the user adds 5 (max 15) to a reduction for that skill, for the rest of the match. |
| Regenerate | II removes Toxin for 10 more healing per stack; III repeats the healing at the start of the ally's next turn. |
| Hormesis | Toxin on the ally heals them for its damage (Toxin status hook). |
| Delirium | Prey also counts a Delirious unit with more than 1 Debuff stack (each counts double). |
| Symbiotic Song | **Simplified:** while it lasts, any indirect hit on a Toxin-carrying enemy heals a random ally of the singer 5. |
| Thrashing Tail | Hitting any Prey resets its cooldown; II marks a random Toxin enemy as Prey when none was hit; III adds 10 against Prey. |
| Exoskeleton | **Simplified:** the extra 5 per Weakness is healed back after each direct hit. |
| Hypnotic Hood | If the target doesn't damage the user before it ends, they fall Asleep for 2 turns. |
| Chrysalis | Stunned and Invulnerable until the end of the user's next turn, then the buffs for 3 turns. |

### 21.7 Life (Earth + Earth)

| Term | Ruling |
|---|---|
| **Flourish** | A macro after a heal on `it`: the overflow (`lastOverheal`) raises their max HP and fills it, up to +30 per unit for the match (each unit's `flourish` counter; `setCounter` now takes `on`, and the new `counterOf` value reads it). Only Life skills that say "which can Flourish" use it. |
| **Bloom** | Life's fusion passive marks the character. A Seedling they create (Earth's Seedling checks its summoner) carries a timer and, if alive at the end of its creator's second turn after appearing, becomes a Treant in place (new `transformMinion` op: 40 max HP, full, Treant Slam and Channel Earth; tags `seedling` and `treant`). |
| **Engine** | `addMaxHp` takes a computed amount (and caps current HP); new `shareDamage` modifier for Common Root; `transformMinion`. |

| Skill | Ruling |
|---|---|
| Oakfist | +5 per full 10 the user has Flourished. |
| Groundswell | Heals every other unit, both sides and minions, with Flourish. |
| Sapling Charge | **Simplified:** the user's next hit (from anyone) lands on a random allied minion instead (`redirectDamage`, consumed). |
| Thornwall | Placed on the user and each of their minions; the first counter removes them all. |
| Wild Growth | While it lasts, each of the user's Seedlings that Blooms gives them 1 permanent Might. |
| Treefall | Can target an allied Treant: it hits a random enemy for its HP (as the Treant), then becomes a fresh Seedling with a new Bloom timer. |
| Heartwood Spear | Channels 2 turns with Channel Growth at each of the user's turn ends, then hits for 50. |
| Strangling Roots | Up to 3 Weakness (2 turns each); the 3rd sprouts a Seedling for the trapper. |
| Take Root | The Boulder becomes a Worldsprout in place if it's alive at the start of the user's next turn. |
| Patient Acorn | +10 max HP and 10 healing at each of its owner's turn ends, no cap. Crush deals half its HP. |
| Bedrock Thorn | For 3 turns, each damage event on an allied Boulder triggers Channel Growth. |
| Harvest | Requires an allied Seedling or Treant; a random one is sacrificed. |
| Twin Saplings | When one of the user's Seedlings dies within its window, a random unbloomed one Blooms at once. |
| Splinter Spike | **Simplified:** sacrifices a random allied Seedling, not the one with the least HP. |
| Taproot | Against a Stunned target, moves 10 max HP to the user (while their Flourish total is at most 20). |
| Living Screen | With an allied minion: the target's next Harmful skill lands on the user's minions (`redirectDamage` on every allied character that turn; a random minion takes each hit, not the one with most HP). With none: it's countered and the user creates a Boulder. |
| Overgrow | The Shield lasts as long as the Stun. When it runs out, what's left heals the user, with Flourish. |
| Evergreen | Swiftness when the user has Flourished at all. |
| Graft | A `maxHp` modifier for 3 turns, filled at once. |
| Tangleweed | **Simplified:** the target can't target minions (`targetExclude`); area skills still hit them. |
| Common Root | Every unit on the user's side shares damage evenly while it lasts. |
| Whirling Vines | One Seedling per enemy minion that died to it. |
| Call of the Grove | Blooms every allied unbloomed Seedling and heals every allied minion to full. |
| Warden Oak | **Renamed** from the doc's "Guardian Oak": content lint forbids "Guardian" (the retired class). A random allied minion (or the user) Taunts; allied Seedlings that survive it Bloom. |
| Ancient Treant | Armor equal to the user's minion count, and allied minions are Untargetable. |

### 21.8 Divine (Holy + Holy)

| Term | Ruling |
|---|---|
| **Radiant** | A new skill tag: the skill targets any unit and is neither Harmful nor Helpful in its tags. A use is Harmful when its first target is an enemy and Helpful otherwise, for counters, Traps and "uses a Harmful skill" triggers. **Simplified:** "can't use Harmful skills" doesn't block Radiant skills. Radiant halves live in macros (`<skill>_enemy_it`, `<skill>_ally_it`); the content lint now follows macros. |
| **Exalted** | Counts as Anointed (`countsAs`). While Exalted, a Radiant skill on an enemy also gives its ally part to the user's weakest ally, and one on an ally also gives its enemy part to a random enemy. |

| Skill | Ruling |
|---|---|
| Hand of Heaven | The user remembers which side they last used it on (counter); switching sides adds 10 and Anoints them until the end of their next turn. |
| Crusader's Advance | A Condemned target's Condemn triggers at once (random Weakness, Vulnerable or Confusion). |
| Absolution | **Simplified:** the weakest ally heals 20 (the prevented damage isn't computed). |
| Apotheosis | Direct damage to an enemy heals the weakest ally 10; each heal the user does deals 10 indirect damage to a random enemy (no loop, since that damage is indirect). |
| Spear of Heaven | Its Sanctify (counts as Sanctify) also Anoints each damager it heals. |
| Sacred Tithe | Counters the enemy's first Helpful skill and casts it as the user on their weakest ally. |
| Seraph | Sanctifies an enemy when a Condemn the Seraph applied triggers (`ownEffectTriggered`), not any Condemn. |
| Revelation | `reveal` with the new `end` option: every hidden effect on the field is revealed and removed. |
| Glory | Exalted for 1 turn plus 1 per enemy below half HP (missing HP more than current), max 3. |
| Harbinger | The user's Exalted is bound to the Harbinger. |
| Unending Light | A 2-turn channel. |
| Unfailing Grace | `protectEffects` keeps the user's Anointed until the end of their next turn. |
| Transfiguration | Each heal the user does is repeated once (doubling it); they can't use Harmful skills. |
| Consecrate | The enemy part removes Anointed and Exalted and strips either if gained during the next 2 turns. |
| Karmic Light | Its Sanctify (counts as Sanctify) heals the user's weakest ally instead of the damager. |
| Benediction | Overflow from each ally's heal hits a random enemy as indirect damage. |
| Twin Radiance | The other side's unit is random (not the weakest). |
| Truce of God | Every unit can't use Harmful skills for 1 turn. |
| Aegis of Faith | The Anointed is linked to the Shield and ends with it. |

### 21.9 Evil (Unholy + Unholy)

| Term | Ruling |
|---|---|
| **Unhallowed** | New `invertHealing` modifier: healing the bearer would receive (any source, including Renew and Lifesteal) is dealt to them as indirect, Bypassing Affliction damage from the healer instead. Their `healed` triggers still hear it. |
| **Tithe N** | A macro: spends up to N of the user's Soul Fragments; `spent` says how many. "Drains a Soul Fragment" (macro `drain_it`): the target loses one if they have any, and the user always gains one. |
| **Engine** | Heals record each unit's last healed turn (counter `healed_turn`). |

| Skill | Ruling |
|---|---|
| Cruel Blade | "Healed since the user's last turn": healed this turn or the previous one. |
| Soulgrinder | Each Fragment spent sends 15 Affliction at a random ally of the target. |
| Soul Hunt | The user's next Harmful skill drains a Fragment from its primary target; with a Fragment spent it also costs 1 less. |
| Take You With Me | The last enemy countered carries a 3-tick doom: if the user dies while it lasts, they die too. |
| Atrocity | Spends up to 3 Fragments: Immortal for that many turns; attackers lose a Fragment to the user. With none, nothing happens. |
| Doom Knell | Each time the target is healed, the channel's remaining time drops by a turn. |
| Damning Shackle | Inverts healing for 2 turns; the first heal also Stuns. |
| Deathless Step | Spends a Fragment for Invulnerable; without one, Immortal. |
| Heartpiercer | Spends a Fragment only when the hit leaves the target below 20 HP, to execute them. |
| Mutual Ruin | The 25 HP is paid as raw Affliction, leaving at least 1 HP. Costs no energy. |
| Waking Nightmare | **Simplified:** the countered Helpful skill's targets take 20 Affliction (its healing isn't computed). |
| Danse Macabre | **Simplified:** while Confused, the user's skills cost 1 less instead of 1 more (assumes 1 Confusion stack). |
| Borrowed Blood | At the end of each of the ally's next 2 turns, they lose 10 HP (raw) unless they damaged an enemy that turn. |
| Eternal Torment | Each hit that leaves the target at 5 HP or less (their Immortal floor) gives the attacker a Fragment. |
| Black Mass | Allies left at full HP lose 10 (raw) and gain a Fragment. |
| Betrayal | The 10 to the user's allies (characters other than the user) is indirect; a spent Fragment spares them. |
| Wail of the Damned | Unhallowed until the end of the enemies' next turn; anyone healed meanwhile (the heal hurts) is also Horrified. |
| Wretched Bulwark | 10 Affliction from each Unhallowed or Horrified enemy, +10 Shield each. |
| Lord of Souls | `protectEffects` keeps the user's Fragments from being spent or removed. |

### 21.10 Dimension (Shadow + Shadow)

| Term | Ruling |
|---|---|
| Banished | Out of the fight until the end of the bearer's next turn: can't act, can't be targeted by either side, takes no damage; its effects neither tick nor count down (turnStart triggers skip it). On an enemy it's a Debuff (`banished`), on the user's side a Buff (`banished_ally`, counts as `banished`). Banishing interrupts the unit's channels. |
| Entangled | A link group made by the `entangle` op. An effect applied to one member is applied once to each other member (no re-spreading). `entangled_buffs` only passes Buffs. A death breaks the bearer out of the group. |
| Folded Moment | FreeAction: one free-action skill plus one normal skill can be queued in a turn. |
| Phase Lunge | Stealth arrives at the start of the user's next turn; any enemy targeting skill first cancels it. |
| Void Walker | Any of the user's non-Stealthy skills used while Stealthed Blinds its enemy targets. |
| Event Horizon | Counters the bearer's first non-Harmful skill; its primary target is Banished. |
| Step Between | No last attacker: only the user is Banished. |
| Crossfold | Each turn: a random ally's random Debuff goes to a random enemy, and a random enemy's random Buff goes to a random ally. |
| Phase Lock | A damage wake-up Banishes instead (Sleep is already gone). |
| Unfold / Safe Harbor | The payoff is an onExpire on a frozen companion effect, so it fires when Banished ends. |
| Tangled Fates | Each skill the bearer uses gives them 1 Confusion, which Entangled spreads to the partner (one direction, simplified). |
| Pocket Arena | Everyone else, minions included, is Banished for the rest of this turn and the enemies' next. |
| Faceless Void | Partner is the ally character with the least HP; Armor and Immune spread through the link. |

### 21.11 Apocalypse (Fire + Ice)

| Term | Ruling |
|---|---|
| **Thermal Shock** | Lives in the fusion passive: when an Apocalypse character gives an enemy a Fire debuff while it has a Frost debuff (or the reverse), it Shocks: 15 Piercing (indirect) and Shattered for 1 turn, once per unit per turn (a `thermal_shocked` marker until the end of the turn). Other units' applications don't Shock unless a skill says so (the Salamander checks its own). |
| **Frostfire** | Counts as Ignite and Chilled (`countsAs`), so Ignite and Chilled checks see it; its own 5 Affliction tick runs Fire's burn aftermath. New `exact` on `has` skips statuses that only count as the key. Frostfire on its own doesn't Shock; any other Fire or Frost debuff added later does. |
| Worldbreaker | "If that Shocks them" is checked before the Frostfire lands (they have another Fire/Frost debuff and weren't Shocked this turn). |
| Coldsnap Dash | The cracked Ignite deals one extra 10 Affliction to each Chilled, Ignited enemy the next skill targets. |
| Ragnarok | The cast turn is the first (3 Might now); each turn's buff lasts until the start of the user's next turn. |
| Comet of Ruin | A hidden mark on the target, linked to the channel: gaining a Fire/Frost debuff ends the channel and lands the 45 at once. |
| Rimeflame Salamander | New minion `onDeath` ops (the dead minion is the actor). |
| Twilight Jotunn | The stun is a Neutral, inline effect bound to the Jotunn, so Swiftness and cleanses don't touch it. |
| Twin Needle | The extra tick is 5 Affliction. |
| Frozen Remedy | A floor of 1 HP while it lasts; a hit that reaches 1 heals 35 at once and ends it. |
| Long Night's Toll | Frostfired enemies' skills get +1 more cooldown on use. |
| Heart of the Glacier | Frostborn is linked to the Shield and ends with it. |

### 21.12 Alchemy (Fire + Water)

| Term | Ruling |
|---|---|
| **Transmute** | New `transmute` op, recipes by the unit's side relative to the actor (enemy: Might → Weakness, Armor → Vulnerable, Focus → Confusion, Renew → Weakness; ally: the reverse, other Debuffs → Renew). Stack for stack, keeping time left; everything leaves before the new effects land. Stores the stacks converted in the variable `transmuted`. |
| **Catalyst** | `catalyst` (Buff) / `catalyst_debuff` (Debuff), 2 turns. While a skill resolves, its damage and healing on the bearer double, as do the stacks and duration of what it applies (not another Catalyst); the Catalyst ends once that skill has resolved. Triggers firing during the skill count as part of it. |
| Kiln Crash | Simplified: while Scorched, the bearer's Shield is halved at the end of each of the user's turns (no Shield-gain modifier yet). |
| Vial Toss | Checked at the end of the user's turns: if the Ignite is gone, they Explode (Explosions hit the user's enemies). |
| Volatile Compound | "They Explode" hits their side (an Explosion caused by the trap's owner). |
| Homunculus | The ally's gain is simplified to 1 Renew. |
| Essence Extraction | Tracked per enemy (`essence_taken`); an enemy's HP is capped at their new max. |
| Slow Distillation | The boil-off happens only if it runs the full 4 turns. |
| Probing Lancet | Simplified to Uncounterable (no Flow bonus). |
| Inversion Circle | Simplified: the Helpful skill is countered; its targets take 15 Affliction and are Weakened for 1 turn. |
| Universal Solvent | New `normalAsPiercing` modifier. |
| Lure Flask | The user heals half of each hit from the enemy they Taunted. |
| The Great Work | Permanent; a Neutral effect gives Immune to Buffs. |
| moveEffects | Now moves effects from every unit in `from` (Circle of Extremes). |

### 21.13 Plasma (Fire + Lightning)

| Term | Ruling |
|---|---|
| **Heat** | A Neutral status (`heat`, max 5, merging) so it shows and can't be cleansed. Each Plasma skill writes its +5 per Heat into its damage. The fusion passive (Plasma Core) gives 1 Heat whenever the character gains Charge, and Melts Down at the end of their own turn with 5 Heat. |
| **Melt Down** | Macro `meltdown`: 20 Affliction to the user (or, with Heat Exchange, 20 healing to every ally), 20 Affliction and 1 Sapped to every enemy, Heat to 0. |
| **Vent** | Macro `vent`: stores the Heat in `vented` and clears it. A Vent skill vents first, so its damage bonus counts the Heat it vented. |
| Coronal Slam / Arc Spark / Superheated Bolt | Companion Debuffs on Ignited enemies that act each time the Ignite ticks (at the end of the user's turn) and end when it's gone. |
| Coilgun | The shot fires when the user next uses a skill (a companion effect), or when 3 turns pass. Each turn held adds 15. |
| Thermite Seal | Triggers after the heal lands (no pre-heal hook). |
| Heat Shimmer | The extra tick is at the start of the bearer's turns. |
| Star Core / Supercharge | Built on `negateNext` with 99 stacks (with an `if` for Star Core's 3 Heat). |
| Brownout | Simplified: while Confused, the bearer generates 1 less energy each turn. |
| Flare Beacon | +1 Taunt turn if any Heat was vented, and 1 Sapped per 2. |
| Reactor Core | Armor computed live from Heat (−5 Normal damage per Heat). |
| Jumper Sparks | The Charge goes to a random ally character. |

### 21.14 Mechanic (Fire + Wind)

| Term | Ruling |
|---|---|
| **Contraptions** | Minions tagged `contraption` that carry the `contraption` passive: healing received ×0 and the new `immuneToEffects` modifier (Stun, Sleep, Confusion, Renew). Repair is a raw heal, which skips healing modifiers. |
| **Upgrade** | Macro `upgrade` on a unit that's a minion or in a Mech Suit (condition `upgradeable`): if below level 3, +1 `upgraded` (+5 damage per level, Neutral), +10 max HP and 10 HP. |
| Rivet Gun | New target `primaryLastAttacker`: the last enemy who damaged the target. If it's a minion, it's Upgraded ("this turn" isn't tracked). |
| Mortar | The Mortar lasts 2 turns; the channel fires from it if it's still standing when the channel ends. |
| Jetpack | A companion Buff, linked to the Leap: once a damaging skill resolves, it Explodes. |
| Pressure Cascade | Counts allies who used any skill earlier this turn. |
| Turret Drop | A `paired_turret` whose new `onDeath` Upgrades the other. |
| Chainsaw | A destroyed minion is detected by the damage dealt reaching its HP. |
| Concussion Grenade | Lands when its 2-tick timer expires (end of the enemy's turn), unless the target used a mobility skill. |
| Tune-Up | A damaging skill that ends the Leap restores it; damage taken removes it. |
| Signal Flare | Simplified: allied minions aren't redirected to the target; each one that damages it is Upgraded. |
| Steam Whistle | A minion already at level 3 isn't Upgraded and loses nothing. |
| Mech Suit | Shield 20, Immune and a Mech Suit Buff (counts as a Contraption, immune to Stuns and Sleep, can be Upgraded); then Leap. |

### 21.15 Brimstone (Fire + Poison)

| Term | Ruling |
|---|---|
| **Sulfur / Erupt** | `sulfur` (Debuff, max 4, merging). Macro `erupt`: 10 Affliction per stack to the bearer, 5 per stack to each allied character of theirs, then the stacks become Toxin and an `eruption` signal goes out. Fire's `burn_aftermath` (any Ignite or Frostfire tick) and `explode` (each enemy hit) call it, so Sulfur works with every Fire skill. |
| Pitch Javelin | Its mark doubles the next Eruption (bearer and splash). |
| Prey hooks | Acrid Orb (while Marked) and Scent of Cinders (while Ignited or Scorched) are added to Poison's `prey` condition. |
| Brimquake | The extra 10 is Affliction, per Explosion from the bearer's enemies. |
| Burning Downpour / extra ticks | Macro `ignite_tick`: 5 Affliction, and an Eruption if the target has Sulfur. |
| Belching Toad | Moves a random Debuff (not the newest) from a random ally to a random enemy. |
| Stokers | Ignite a random enemy with Sulfur (no "most Sulfur" target yet). |
| Hellmouth | A companion effect hears the channel end (`ownEffectEnded`), whether it expires or is broken. |
| Strike the Match | The energy comes at once if the target already has Sulfur for the Ignite to set off. |
| Asphyxiate | A Neutral, inline stun: Swiftness (keyed to Stun) and Immune (Debuffs) don't touch it. |
| Brimfire Crest | Heals for all indirect damage the bearer deals to enemies; Flameborn's own Ignite healing is skipped meanwhile so it isn't counted twice. |
| Stench of Sulfur | Simplified: Sulfur the user gave that's cleansed away deals its bearer 10 Affliction. |
| Lure of the Pit | The jumped Taunt lasts 1 turn. |
| Pit Lord | Each enemy who uses a Harmful skill on the user gains 1 Sulfur (Immune already blocks the Debuffs). |

### 21.16 Sun (Fire + Earth)

| Term | Ruling |
|---|---|
| **Corona** | `corona` (Buff, merging, 3 turns; gaining refreshes). Gained through macro `gain_corona`, which trims it to 3 (5 during Solar Maximum). It ticks at the end of its applier's turn: 5 Affliction per stack to every enemy, 5 healing per stack to every ally. |
| **Solar Flare** | Macro `solar_flare`: spends all the user's Corona into `flared`. |
| Scorched Earth | As Kiln Crash: while Scorched, the Shield is halved at the end of each of the user's turns. |
| Rolling Sunstone | A Boulder-type minion whose `onDeath` Explodes (destroyed or launched). |
| Horizon | Rises when its 2-tick timer ends (end of the enemy's turn). Enemies who used a Harmful skill meanwhile are Ignited. |
| Sunflower / Sunseed | Start with 1 permanent Corona (gaining more makes it a normal 3-turn Corona). Scatter Seeds' Seedling is the Sunflower's own. A Sunseed's Corona passes to its creator through `onDeath`, including on expiry. |
| Ripening Vine | Each Seedling casts Channel Earth (as itself), then loses 5 HP. |
| Upwelling Magma | The Sun passive tracks the turn the user last dealt direct damage; turns since are counted as user turns (half the turn count). |
| Long Summer | Each turn extends the user's Corona; the double damage applies to Ignited enemies while the Corona's applier channels it. |
| Basking | Each Corona tick gives 1 Might for 1 turn. |
| Heliotrope | One inline Buff (+5 direct damage, heals 5 each turn) that moves to the ally with the least HP at the start of the user's turns. |
| Drought | While Scorched, whatever healing the bearer gets also goes to a random ally of the user (the denied half). |
| High Noon | Other enemies get a Debuff the user is invulnerable to (`invulnerableTo`). |

### 21.17 Phoenix (Fire + Holy)

| Term | Ruling |
|---|---|
| **Kindle** | Kindle skills are Radiant (target anyone; Harmful only on an enemy) and run macro `kindle` with `burn`: on an enemy, that damage and Ignite; on an ally, that healing and 2 Renew. |
| **Rebirth / Ashes** | Rebirth holds the bearer at 1 HP (`hpFloor`); a hit that leaves them at 1 ends it and puts them in Ashes (Neutral: Untargetable by both sides, takes no damage, can't drop below 1). At the start of their next turn, macro `rise` brings them to 25 HP (40 with Undying Phoenix). Ashes doesn't stop channels, so Sunfall Lance still lands. Simplified: a hit leaving them at exactly 1 HP also counts as dying. |
| Pyreheart Fury / Undying Phoenix | Rising extends the Rage or Titan (and its Might/Armor and Immune) by 3 turns and gives a fresh 3-turn Rebirth. |
| Wingbeat | Allies in Ashes rise at the end of this turn. |
| Smoldering Nest | Fires when the bearer's damage leaves a unit dead or in Ashes. |
| Phoenix Chick | `onDeath` leaves its creator a 2-tick egg that hatches a Firebird. |
| Blinding Plumage | Simplified: a 3-turn Stun on a Condemned target. |
| Dance of Embers | Counts direct damage from the user's Radiant skills. |
| Phoenix Blessing | Its own Rebirth (counts as Rebirth) that heals 25 if it expires unused. |
| Cinders of Doubt | For 2 turns, each Weakness, Vulnerable or Confusion the target gains lasts 1 turn longer. |
| Sanctified Pyre | Each direct hit on the Sanctified target (which heals the attacker) makes its Ignite burn. |
| Second Dawn | New `revive` op and `revived` event: fallen characters on the user's side return with 20 HP and no effects. |
| Cocoon of Flame | Shield and a can't-act effect for 3 ticks (through the user's next turn); what's left heals every ally. |
| Blazing Challenge | Each hit from the Taunted enemy gives 1 Focus for the next skill (any skill, not only Kindle). |

### 21.18 Devil (Fire + Unholy)

| Term | Ruling |
|---|---|
| **Hellfire** | Debuff counting as Ignite and Horrified: 5 Affliction at the end of its applier's turn (with Fire's burn aftermath), and immune to Buffs. |
| **Contract** | An inline effect that counts as `contract` (the benefit is applied beside it; its onExpire is the price). Contracts on the user's side are Buffs; ones forced on enemies (Fine Print, Hellraze) are Neutral, so Horrified doesn't stop them. New `expire` op collects early (Collect; Collection Day collects twice). |
| **Devil's Ledger** | Fusion passive: when a unit dies holding a Contract this character gave, they gain 2 Soul Fragments; when one dies with their Price on Their Head, the killer's cooldowns drop by 10 and the user gains 1 energy. `eventTargetHad` now takes `effects`. Contracts from the Imp Notary's Offer belong to the Imp, not the Ledger. |
| Hellbolt | Each Helpful skill used on the Hellfired target (whose Buffs fail) gives the user 1 Soul Fragment. |
| Imp Captain | Simplified: only the Captain's own hits gain 5 per Soul Fragment of its summoner. |
| Soulburn | 3 turns; the user heals a flat 15 per turn. |
| Toasting Fork | The user heals 5 at the end of each of their turns while the target is Ignited. |
| Soul Snare | Counts Ignite, Hellfire, Frostfire and Scorched on them. |
| Binding Clause | Simplified: 2 turns of Stun on a Contract holder. |
| Dance with the Devil | Their Ignites also tick at the start of each of their turns. |
| Fair Trade | Only when the enemy has more HP; the transfer ignores modifiers. |
| Pact of Flame | The price is 20 minus all healing received meanwhile (Lifesteal included). |
| Double or Nothing | Simplified heads: each Debuff lasts 2 turns longer, and Weakness, Vulnerable, Toxin and Confusion gain 1 stack. |
| Choir of the Pit | Each Helpful skill used on a Horrified enemy gives a random ally of the user 1 Might. |
| Pyre Swing / Dare the Damned | A kill is detected by damage reaching the target's HP; Dare explodes on each hit that leaves the user at Immortal's floor. |

### 21.19 Ritual (Fire + Shadow)

| Term | Ruling |
|---|---|
| **Rite (N)** | An inline Neutral effect on the user that counts as `rite`, with N stacks, remembering the target. Shared triggers: each skill the user uses is one step (two during Dance of Candles); a `rite_advance` signal from the user or their minions is one step; `rite_complete` completes it; gaining Stun, Sleep or Banished breaks it (not while Warding Candle lasts). The last step expires it, and its onExpire is the effect (run twice during Avatar of the Rite). `clear_rite` keeps one Rite at a time. The skill that starts a Rite doesn't count for it. |
| Acolytes / Effigy | Acolyte skills send `rite_advance`; the Effigy's `onDeath` sends `rite_complete`. Chains of Smoke, Dark Liturgy and Invocation advance it by signal too. |
| Candlestep | The carried flame Ignites everything the user's next Harmful skill damages. |
| Severing Spark | Simplified: Isolated if the target has no Buffs. |
| Shadowflame Bolt | Simplified: each skill they use while Blinded Ignites them. |
| Rite of Ruin | Enemies count their own skills (`ruin`) from the moment it starts. |
| Snuff the Candles | Heals 10 per step counted (`rite_counted`). |
| Ritual Knife | 25 if a Rite completed this turn or the user's Rite has 1 step left. |
| Hush of Smoke | Enemies' Sleep is protected from removal until the user's next turn. |
| Veilbrand | Simplified: a Stealthed attacker who damages the Ignited target gets their next skill counted as Stealthy. |
| Cinder Tether | Healing either receives is undone and dealt to the other as Affliction. |
| Smokewall | A Shield checked at the start of the user's turns: it ends once they're no longer Stealthed. |

### 21.20 Glacier (Ice + Water)

| Term | Ruling |
|---|---|
| **Icebound** | New `freezeCooldowns` modifier: the bearer's cooldowns skip their tick. It's checked as the turn ends, before durations count down, so a 1-turn Icebound covers the enemy's own cooldown tick. |
| **Meltwater** | New `cooldownTick` modifier: cooldowns tick 1 extra at the end of the bearer's turns. Skills it frees are counted in the unit's `thawed` counter (Spring Thaw reads it at the start of the next turn). |
| New values / ops | `skillCooldown` (the base cooldown of the skill in scope, for Pressure Ridge and Thin Ice), `skillsOnCooldown` (Under the Ice, Glacier Form) and `swapCooldowns` (Borrowed Hour; the skill being used is skipped). |
| Crevasse | Simplified: the triggering Harmful skill Icebinds them for 2 turns and raises all their cooldowns by 1 (not that skill's cooldown doubled). |
| Glacial Erratic | A companion effect hears the Mark expire unspent (`ownEffectEnded`, reason expired) and deals 30. |
| Stolen Thaw | Simplified: 2 turns of Meltwater, not the Icebound's remaining time. |
| Hoarfrost Pick | Frost debuffs on the target can't be removed (they don't pass through Immune). |
| Frozen in Time | Simplified: Icebound for 2 turns keeps their cooldowns where they are, and they rise by 1. |
| Calving | Simplified: the two share all their Debuffs once (`shareEffects`). |
| Advancing Glacier | The Ice Tongue counts its own turns. |

### 21.21 Aurora (Ice + Lightning)

| Term | Ruling |
|---|---|
| **Shimmer** | The existing `costToRandom` modifier: every pip of the bearer's costs is paid as random energy. |
| **Dazzled** | At the start of each of the bearer's turns, new op `shiftEnergy`: one random energy of their player becomes another color (shown as an `energyGained` event with -1/+1). |
| New ops / values | `stealEnergy` (Drink the Light: 1 of the enemy player's most-held color), `energyOf` (a unit's player's energy, or how many colors they hold), `totalHp`. |
| Hoarfrost Crash | Frost debuffs on everyone hit last 3 ticks longer (once) and can't be removed meanwhile. |
| Streak of Light | The target is marked Streaked; the user's next skill deals 10 more to Streaked enemies. |
| Polar Lance | The target is Chilled for the wait, and each of their skills meanwhile Saps them once per energy it cost. |
| Rime Snare | Simplified: the first time the target has a Frost debuff at the end of the user's turn, those debuffs last 2 turns longer and they take 15 Piercing. |
| Stray Aurora | Simplified: it's the user's minion (enemies target it normally). It hits a random enemy if the enemies' side has more total HP, else a random ally. |
| Shock Icicle | Simplified: 25 if the target's player has 1 or no energy. |
| Lightshow | Simplified: their non-Strategic skills are stunned for 2 turns. |
| Dance of Lights | Simplified: each skill gives 1 Charge, every second one also 1 Swiftness. |
| Color Drain | Each turn they start Dazzled, they're also Sapped. |
| Arc of Lights | The arc goes to a random other enemy. |
| Polar Beacon | While Taunted, each Sapped gained adds one more. |

### 21.22 Winter (Ice + Wind)

| Term | Ruling |
|---|---|
| **Snowbound** | Debuff: strips Swiftness, Rushing and Leaping when gained, blocks them (`immuneToEffects`), +1 cost on Charge, Maneuver, Mislead and Dance skills. Wind's `immobile` condition now includes it. Winter's Frost-debuff lists include it. |
| Bitter Blow | Simplified: Snowbound if the target currently has a mobility buff. |
| Snowball | Counts consecutive uses by turn number (each of the user's turns is 2 apart). |
| Powder Leap | Simplified: only the last enemy who damaged the user is Snowbound. |
| Great Yeti | New `spendEnergy` op: at the start of each of its owner's turns, 1 random energy, or it dies. |
| Snow Sprites | A Flurry marks the target until the end of the turn; a second Flurry Snowbinds them. |
| Long Winter | Each turn pushes the enemies' Frost debuffs 2 ticks further out. |
| Updraft Feint | Simplified: the user Leaps normally (the "not spent by the next damaging skill" clause isn't modeled). |
| Snow Dance | Uses the `incomingNegated` trigger (their Swiftness stopped a Stun). |
| Rime Mantle | While Frostborn, Frost debuffs they apply get 1 more turn (`eventEffect`). |
| Frostfeather | The second hit from an ally (any ally) Snowbinds them. |
| Dead of Winter | Healing modifiers ×0 on every unit (raw heals, such as Repair, still work). |

### 21.23 Stasis (Ice + Poison)

| Term | Ruling |
|---|---|
| **Suspended** | New `suspendEffects` modifier, handled like Banished's freeze: the bearer's other effects don't tick, count down or fire turn-start triggers (the bearer still acts and takes damage). `suspended` (Debuff) on enemies, `suspended_ally` (Buff) on the user's side. |
| **Thaw** | Suspended's onExpire runs macro `thaw`: 10 Affliction per Toxin stack at once. The `expire` op Thaws early (Frozen Fang, Crack the Ice). |
| Frozen Stomp | The splash (5 per Toxin stack, half the Thaw) goes to each allied character of the target when the Suspension ends. |
| Freezing Lunge | Every enemy gets Poison's `prey` mark through the user's next turn. |
| Stopped Clock | Simplified: cooldowns are cut to 0 meanwhile; when it ends, every skill of theirs gets +2 cooldown. |
| Nine Winters | Enemies carry a linked Suspension while it channels; a companion effect makes them all Thaw when it ends or breaks. |
| Chilling Acid | At the end of each of the user's turns, a Toxined target is Chilled (or its Chill extended). |
| Cold Shelter | Simplified: Frostborn for 2 turns. |
| Serpent's Measure | Each enemy with Toxin at the end of the user's turns is marked Prey until their next turn. |
| Frozen Quarry | Added to Poison's `prey` condition: Frost debuffs count toward the stack total. |
| Frozen Instant | Uses `deferHits`: each hit is held and lands 3 turns later, halved, as Affliction (not all at once when it ends). |

### 21.24 Myth (Ice + Earth)

| Term | Ruling |
|---|---|
| **Legend / Mythic** | The Saga passive gives 1 Legend (Neutral, merging) when the character uses a Myth skill (new `eventSkill.elements`) or kills a unit. Macro `gain_legend`: not while Mythic; at 3, `become_mythic` (Legend removed, +20 max HP and 20 healing, Mythic for 3 turns: 2 Armor, immune to Stuns; the max HP goes when it ends). Myth riders check Mythic on the user. |
| Mountain Stomp | Mythic: one Boulder for the target and one per ally of theirs. |
| Runic Ward | Mythic picks a reflecting version at cast time. |
| Giant's Spear | A growing channel: 20, +20 at the end of each of the user's turns; lands at 60 or when the user is damaged (it lasts at most 3 turns). |
| Troll Bridge | Simplified: a skill "fingerprint" (cost and cooldown) is compared with the one they used on their previous turn. |
| Mammoth | Its onSummon gives every enemy a Debuff bound to it that protects their Frost debuffs. |
| Age of Ice | Characters take 25 normally; each enemy minion hit that dies (any minion while Mythic) is destroyed and the user creates a Boulder. |
| Draught of Ages | 5 healing per round (2 turns). |
| Trollkin | A Troll's onDeath creates a Boulder brought down to 20 max HP. |
| Awakening the Ancients | On completion, allied Boulders transform into Rime Giants (full HP at 45). |
| Rimecut | Simplified: +5 per Frost debuff (not per turn left), up to 25 total. |
| Frozen Riddle | Simplified: for 3 turns, all their cooldowns freeze while they have a Frost debuff. |
| Turned to Stone | A companion effect hears the Shield break (`depleted`) and ends the Stun; Mythic skips it. |
| Kinslayer's Doom | Handled by the Saga passive's `died` listener. |
| Jotun Sweep | Simplified: 10 and Frostbitten to a random other enemy (no "used a Harmful Strategic skill" tracking). |
| Frozen Rampart | Simplified: no redirect from allied minions. |
| Old Feud | Removes the user's earlier Old Feud mark; the Taunt itself is permanent. |

### 21.25 Prism (Ice + Holy)

| Term | Ruling |
|---|---|
| **Refract** | Written into each skill: half strength (damage rounded down to 5) on a random other unit of the target's side, skipped while the user has Lens. |
| **Lens** | Buff gained until the user's next skill (`gain_lens`): direct damage ×1.5, and that skill doesn't Refract. Simplified: healing isn't boosted. |
| Lightspeed | The next skill is free (`freeSkills`) and gets +2 cooldown. |
| Spectrum Ward | The countered skill becomes 15 damage to a random ally of its user. |
| Burning Glass | The enemy the user last damaged carries a Focused mark; hitting them again within 3 ticks grants Lens. |
| Standing Decree | The Condemnation is reapplied at the end of each of the user's turns while the trap lasts. |
| Afterglow | Simplified: the last skill comes off cooldown, and the user's next skill (from their next turn) costs nothing; no automatic repeat. |
| Hovering Prism | While it stands, the user's direct hits on enemies refract 5 per 10 dealt to a random other enemy (any skill, not only single-target). |
| Colorless Nova | Simplified: a random Buff, not the longest. |
| Dispersion | Each turn refracts to one more random enemy (5 damage and Sanctify each). |
| Diffused Light | Refracts 20 to the ally with the least HP, if that isn't the target. |
| Beacon of Mercy | Compares the weakest targetable enemy with the weakest ally. |
| Frozen Gleam | Simplified: a 2-turn Taunt. |
| Colossus of Light | Direct hits on the user are halved; the amount they take strikes a random enemy. |

### 21.26 Lich (Ice + Unholy)

| Term | Ruling |
|---|---|
| **Phylactery** | A minion (30 HP, 2 Armor) whose onSummon gives its creator `phylactery_bond` (HP floor 1), bound to it. `make_phylactery` creates one or restores it to full; `feed_phylactery` heals it by `feed` or creates one with that max HP. One per Lich is kept by these macros. |
| **Soulfrost** | Debuff (counted in Frost-debuff lists here): direct damage to the bearer gives its applier 1 Soul Fragment, once per turn (a per-bearer turn counter). Winter of Souls and Heart of Ice use their own variants that count as Soulfrost. |
| Chill Stride | Simplified: 1 Focus (not 2 when the next skill targets a Soulfrosted enemy). |
| Hidden Vessel | The counter goes on the user and every allied minion. |
| Death's Icicle | A kill is detected by damage reaching the target's HP. |
| Retreat to the Vessel | An Invulnerable-like Buff that the Phylactery's own damaged trigger removes. |
| Frost Wight | Its HP floor of 1 applies while its creator has a Soul Fragment; a hit that leaves it at 1 spends one. |
| Soul Siphon | Simplified: 1 Soul Fragment drained (taken from them if they have one), +1 if they were Soulfrosted. |
| Skeletal Mage | Pushes the enemies' Frost debuffs out each turn so they don't count down. |
| Deathly Pallor | Healing above 60 HP is taken back at once. |
| Embalm | Each turn, the ally's other Buffs (not Might) are pushed back out. |
| Touch of the Grave | Immune to Buffs; each Helpful skill used on them gives the user a Soul Fragment (up to 3). |
| Hoarded Life | The absorbed damage is counted; when the Shield ends for any reason, it feeds the Phylactery (at least 10). |
| Guarded Urn | The Taunt comes from the Phylactery; the Taunted enemy's damage to Phylacteries is halved. |

### 21.27 Night (Ice + Shadow)

| Term | Ruling |
|---|---|
| **Dusk N** | Hidden Debuff whose stacks are N. It counts down at the start of each of the bearer's turns after the first, so N of their turns pass in full; at the last count, Midnight. Applying Dusk to a bearer who has it deepens it by 1 instead (macros `dusk` with the variable `dusk`, and `deepen_dusk`). |
| **Midnight** | Frozen Sleep for 1 turn: counts as Sleep, Frostbitten, Chilled and Numb (can't act, no cost reductions, can't apply Buffs), and damage doesn't wake them. Then First Light for 2 turns (immune to Dusk). |
| **Dormant** | Buff: can't act, untargetable by enemies, +10 Shield (1 turn) at the end of each of the applier's turns, wakes with 1 Focus. `dormant_enemy` is the enemy version (no Shield, no Focus). |
| Polar Night | All their skills count as Stealthy while it lasts. |
| Breaking Ice | A hidden Buff on the ally; it springs on the first enemy who targets them with a Harmful skill. |
| Rime Lance | A companion effect hears the Mark be spent (consumed or removed). |
| Stolen Hours | The user's side's Debuffs lose 2 ticks; the target's gain 2. |
| Call the Revenant | New target `summonerLastAttacker`: the last enemy who damaged its summoner (else a random enemy). |
| Winter Solstice | Dormant first, then the channel (so the Dormant doesn't break it). |
| Blackfrost Fang | Simplified: an ended Blind becomes 2 turns of Frostbitten and Numb. |
| Drowsing Waltz | An HP floor of 30 while it lasts; the first hit that reaches it puts the user to Dormant. |
| Hidden Moon | Stealthed allies who hit the target get their next skill counted as Stealthy (Ritual's Veiled by Smoke). |
| Crescent Cleave | Simplified: the splash prefers a random enemy with Dusk. |
| Sleeping Giant | Its own Dormant variant: 20 Shield per turn, and every enemy gains Dusk 2 when it wakes. |

### 21.28 Current (Water + Lightning)

| Term | Ruling |
|---|---|
| **Soaked** | Debuff. The Conductor passive (every Current character) gives their Current skills' direct hits +5 against Soaked units (new modifier filter `elements`). When a single-target (new `eventSkill.single`) Current skill, or an Overflow ally's skill, directly damages a Soaked unit, macro `conduct` deals the same amount (indirect, so it doesn't chain) to every other Soaked unit on that side. |
| Breakdown Surge | Simplified: each enemy with a Shield or Armor before the hit takes 10 Affliction at the start of the user's next turn. |
| Galvanic Fury | The user's single-target hits also strike other Sapped (non-Soaked) enemies for the same amount. |
| Conductor's Lance | Simplified: it conducts as usual, and the user gains 1 Charge per other Soaked enemy; their Soak doesn't end. |
| Electric Rain / Still Water | Their channel and counter hits conduct explicitly. |
| Still Spring | Each turn, a stack of Renew is added back after it ticks. |
| Overflow | +5 to Soaked enemies and conducting single-target hits for 3 turns. |
| Waterlogged | Each indirect hit on them adds 1 Confusion (max 3). |
| Backwash Lure | Any healing the user receives (not only Renew) strikes the enemy they Taunted. |

### 21.29 Mist (Water + Wind)

| Term | Ruling |
|---|---|
| **Fog** | New `fogged` modifier, handled in the pipeline after Blind: an enemy single-target skill aimed at a Fogged unit lands on a random legal unit of that side. A redirect onto someone else stamps the Fogged unit's `fog_redirect_turn` counter and sends a `fog_redirect` signal (source: the Fogged unit, target: the skill's user). Fog's onExpire condenses it into 2 Renew; variants condense into 3 (Mercy of the Mist) or 6 (Marid Form). Removing Fog (Morning Dew, Veil of Mist) doesn't condense it. |
| Fogbank | The counter goes on every Fogged ally; the first one to fire removes the rest. |
| Mistpiercer | Any damage to the user meanwhile cuts the shot to 30. |
| Choking Fog | Blind's `randomPrimaryTarget` until their first Harmful skill, which also Confuses them. |
| Condensation | Simplified: 20 more healing if the target was healed since the user's last turn. |
| Will-o'-Mists | Each one's onSummon gives every ally a Fog bound to it. |
| Whisper Knife | Simplified: Uncounterable (it still triggers damage reactions). |
| Squall in the Fog | Hits a random enemy (no target choice). |
| Heavy Air | Counts as Cloud's Low Ceiling, which Wind's `immobile` condition checks. |
| Stolen Wind | Simplified: the user takes all mobility buffs from both enemies hit. |
| Foghorn | Simplified: for 1 turn, Harmful skills aimed at the user are reflected. |
| Voice in the Fog | A hidden `forceTarget` Debuff. |

### 21.30 Serum (Water + Poison)

| Term | Ruling |
|---|---|
| **Dose** | A merging Buff (so Horrified blocks it and Immune doesn't): 5 healing per stack at the end of its applier's turn. When the bearer's total Dose reaches 4 (not during Mutagen), macro `overdose`: 10 Affliction per stack, all Dose removed, an `overdose` signal. |
| Prey hooks | Pressurized Dose (while they have Dose) and Weak Constitution (any Weakness) join Poison's `prey` condition. |
| Stimulant Binge | Immune to Debuffs and +1 Might each turn (max 3); a later turn without a direct hit ends it with 20 Affliction. |
| Acid Rain | The pooled Dose goes to a random enemy who has Dose (not necessarily the most). |
| Extraction / Remedy | Radiant: on an enemy or an ally. |
| Microdose | Ticks at the start of each of the target's next 3 turns. |
| Toxic Injection | Simplified: Toxin also ticks at the start of their turns. |
| Flushing Drip | Any healing (not only Renew) flushes a Debuff. |
| Clotting Agent | Simplified: a normal Shield, plus 10 less Affliction from each hit. |
| Bitter Tonic | Any healing on the user's allies (not only Renew) gives the Taunted enemy 1 Toxin. |

### 21.31 Slime (Water + Earth)

| Term | Ruling |
|---|---|
| **Oozes** | Minion `ooze` (20 HP, Slap). Its passive Splits it when it survives enemy damage with 10+ HP and the side has fewer than 4 Oozes: a new Ooze with half its HP appears, it keeps the rest, and an `ooze_split` signal goes out. `make_ooze` creates one with `ooze_hp` HP (if under 4). Its onDeath sends `ooze_died` (and bursts during Burst Bubble). |
| **Engulf** | `engulfed` (Debuff): Stunned, 5 Affliction at the end of its applier's turns, 3 turns; applied from the holding Ooze and bound to it, so it ends when that Ooze dies. `engulf_new` makes an Ooze that Engulfs `it`. |
| Plunging Fist | Simplified: the user's Oozes heal 10 (not just the holder). |
| Slime Roll | Simplified: Rod-of-Domination-style redirect of damage to a random allied minion for 1 turn. |
| Gel Parry | The Ooze has 10 HP per energy the countered skill cost (10 to 40). |
| Gel Snare | The heal is taken back, and an Ooze with that much HP (10 to 40) Engulfs them. |
| Digest | Simplified: a flat 20 Affliction when Engulfed. |
| Primordial Pool | Counts `ooze_died` signals and re-forms that many Oozes (10 HP) each turn. |
| Slick Shimmy | Simplified: the user's Debuffs are removed at the end of each of their turns. |
| Irrigate / Fertile Silt | Any healing on the ally (not only Renew) counts. |
| Settling Silt | Simplified: Stuns on them can't be removed (Swiftness still works). |
| Quagmire | Simplified: +1 random cost on all their skills. |
| Quivering Wall | Melts by lowering all the user's Shields by 10 each turn. |
| Gelatinous Giant | Each enemy hit while the user has 20+ HP splits off an Ooze with a quarter of their HP, which they lose. |

### 21.32 Anointment (Water + Holy)

| Term | Ruling |
|---|---|
| **Unction** | Merging Buff: at the end of its applier's turn, one stack goes to remove a random Debuff (if any) and heal 10 (every ally during Living Font). |
| **Chrism** | Buff counting as Anointed: each Helpful skill its bearer resolves Anoints the other allies it targeted until the end of their next turn. Pilgrim's Rush, Chrismation and River of Grace hook the same moment (Focus, Might, Chrism). |
| Cascade of Grace | Spending Anointed (or Chrism) cuts the other cooldowns by 2 if there are 2+ enemies, else 1. |
| Calm Waters | The counter sits on the user and every Anointed ally; the first to fire removes the rest. |
| Font Ward | Each Debuff the enemy applies to the user's side hurts them 15 and gives its target 1 Unction. |
| Baptismal Font | Its onSummon gives every unit a Debuff immunity bound to it. |
| Scouring Current | Simplified: while the user has Flow, enemies they hit are Shattered for 1 turn (from the next hit on). |
| Turned to Grace | Simplified: the countered skill's targets heal 20. |
| Submission | A mark on the target, and allies who are Anointed deal it 10 more. |
| Holy Oil | Simplified: immune to Debuffs, and each Harmful skill used on them gives 1 Unction. |
| Offertory | Each skill they use while Confused gives the user's player 1 energy per Confusion stack. |
| Shield of the Font | All Unction is spent at once: that many Debuffs removed, 15 Shield per stack for 1 turn. |

### 21.33 Blood (Water + Unholy)

| Term | Ruling |
|---|---|
| **Blood Price** | New skill tag `BloodPrice` and modifier `bloodPrice`: the skill's random pips cost 0 energy, and 10 HP each is paid as it resolves (raw Affliction to the user, stored in their `blood_paid` counter). It can't be queued, and fails, if the HP would kill the user. |
| **Hemorrhage** | Debuff, merging, max 5: at the end of its applier's turn, 5 Affliction per stack, then +1 stack. Any healing removes it (not during Hemophilia). |
| Quickened Pulse | Any healing (not only Lifesteal) gives 1 Renew per 10 HP for its duration. |
| Bloodbound Familiar | It has an HP floor of 1, passes the damage it takes to its summoner and heals back to full; healing it heals the summoner; it dies when they do. |
| Blood Elemental | Its max HP becomes what the user paid. Simplified: it doesn't return its HP when it expires. |
| Exsanguinate | Each turn heals the user 5 per Hemorrhage stack on the target. |
| Restitution | The target's last attacker loses 20 HP (raw). |
| Blood Doping | The crash is a Neutral inline stun, so Swiftness can't stop it. |
| Blood Chant | Simplified: until the user's next turn, the other allies pay their own random costs in HP. |
| Clotting Ward | Lasts until the start of the user's next turn, and their Renew heals once more at that moment. |
| Leeching Sweep | While the user has Lifesteal, their indirect damage to enemies also heals them. |

### 21.34 Mirror (Water + Shadow)

| Term | Ruling |
|---|---|
| **Reflect** | The engine's reflect intercept, set up per skill. |
| **Mimic** | `castSkill` with the new `lastUsedBy` (the skill in that unit's `lastSlot`) or `eventSkill`, cast by the user at no cost; a copied ally-target skill lands on its caster. Nested casts stop at depth 2, so Mimics can't copy each other forever. |
| Splintered Pane | Simplified: the first Harmful skill aimed at the user before their next turn is Reflected (not only multi-target ones). |
| Looking Glass | Debuffs an enemy gives the user are copied onto that enemy and removed from the user (new `eventEffect.remove`). |
| Contrary Fury | Weakness and Vulnerable are offset and flipped: +10 direct damage per Weakness, −10 Normal damage taken per Vulnerable. |
| False Reflection / Mirrored Mending | The Helpful skill is countered and recast by the user on their own side. |
| Through the Glass | The Reflect sits on every other ally; the first to fire removes the rest. |
| Glintbolt | Simplified: when the Mark is spent, every ally's cooldowns drop by 1. |
| Dark Tide | Simplified: Mimics the last skill of a random enemy character. |
| Changing Places | The HP swap ignores healing and damage modifiers. |
| Mirror Shade | When it dies, its last attacker recasts their last skill on themselves. |
| Hall of Mirrors | Simplified: enemy Harmful skills aimed at the user are Reflected while it channels. |
| Foiled Ambush | Simplified: doubled against Confused or Blinded targets. |
| Hypnotic Ripple | When the Sleep is broken early, a random ally of the sleeper falls Asleep. |
| Inverted Echo | New `invertCooldowns`: ready skills go on cooldown 1, cooling ones become ready. |
| Silvered Guard | The Mimic copies the user's last attacker's last skill. |
| Mocking Reflection | Each Harmful skill the Taunted enemy resolves is Mimicked back at them. |
| Mirror of the Faceless | New `copyEffects`: the enemy's Buffs are copied once (not refreshed each turn). |

### 21.35 Storm (Lightning + Wind)

| Term | Ruling |
|---|---|
| **Tempest** | The pipeline now broadcasts `used:<element>` for every skill use. Each Storm character's Storm Heart passive hears `used:Storm` from their side (minions included) and gains 1 Tempest (Neutral, max 5); at the end of their turn with no Storm skill used, −1 (not during Song of the Storm). Simplified: Tempest is tracked on each Storm character, not once per team. |
| **Eye of the Storm** | At 5, a Buff: the bearer's next Storm skill (not Storm Warning) also hits every enemy it didn't target for 15, and Tempest drops by 2. Simplified: a flat 15, not the skill's own damage and effects. |
| Squall Strike | Simplified: +5 per Tempest (max +15). |
| Downburst | Simplified: 1 Swiftness at the start of each of the user's turns for 2 turns. |
| Storm Rider / Tailwind | While active, the bearer's non-Storm skills send `used:Storm` too. |
| Summit Strike | Bypassing 25 Piercing on the enemy with the most HP (it can't reach Stealthed or Untargetable enemies). |
| Mending Arc | 25 to the target, 15 to the other ally with the least HP, 5 to the rest. |
| Shearing Gale | Simplified: Leaping's +5 applies as usual, and the Leap still ends. |
| Static Lure | Simplified: while Taunted and Sapped, 1 less energy each turn. |

### 21.36 Battery (Lightning + Poison)

| Term | Ruling |
|---|---|
| **Cells** | `cell` (Neutral, merging, max 5, never decays). The Battery Core passive turns Charge gained while at 3 into a Cell (simplified: gaining Charge that reaches 3 also stores a Cell). **Discharge** is macro `discharge`: all Cells spent into `cells`. |
| **Corroded** | Debuff: −10 to every Shield on the bearer at the end of its applier's turns, and immune to Armor. |
| Toxic Circuit | Simplified: every enemy it hits gains 1 Toxin. |
| Jump Start | 2 random energy now; the player's next energy generation is 2 lower. |
| Afterspark | Strikes again when its 2-tick timer ends if the user gained Charge meanwhile. |
| Railgun | A kill (damage reaching their HP) stores the spent Cells again. |
| Locked Relay | Simplified: Sapped once, and 1 less energy each turn while Sapped, for 2 turns. |
| Short to Ground | Simplified: a dissolving Shield deals a flat 10 Affliction. |
| Shared Grid | Each ally character's HP becomes the team average (raw changes, capped at max HP). |
| Acid Arc | Simplified: the other enemy gets 2 turns of Corroded (not the target's exact time left). |
| Etching Glare | Its own Corroded variant passes the 10 Shield it strips to the user. |

### 21.37 Magnet (Lightning + Earth)

| Term | Ruling |
|---|---|
| **Attract / Repel** | Written with `moveEffects` (all of the named effects, keeping stacks and time left) and `stealRandom` (one random Debuff). Shield "by amount" is lowered on the enemy (`boostShields`) and given to the user as a new Shield. |
| Lodestone Fist | Attracts half the Might difference (rounded down), each stack lasting 2 turns. |
| Reel In | Armor, Shield, Might or Charge the target gains is moved to the user (all they have of those). |
| Clinging Filings | Simplified: the swarm doesn't get the "only skills that hit that enemy" protection. |
| Pole Reversal | Simplified: one-way: the user takes their Armor, Might, Charge and Shield. |
| Clamp | Simplified: what's taken isn't given back. |
| True North | Simplified: the target is Vulnerable until the user's next turn. |
| Shared Field | Only the base `shield` status is pooled. |
| Rebound Plate | Enemies who strike the Shield are marked; when it expires, one Debuff is Repelled onto each. |
| Opposite Poles | A `targetExclude` keeps every other enemy out of the user's reach. |
| Iron Colossus | Armor from the absorbed Boulders' total HP (1 per 15); the Boulder that falls away has 10 HP per stack. |

### 21.38 Vengeance (Lightning + Holy)

| Term | Ruling |
|---|---|
| **Vow** | Buff: each direct enemy hit on the bearer gives 1 Wrath. |
| **Wrath** | Merging Buff, max 3: +10 direct damage per stack; after a skill of theirs deals direct damage, it's spent for 1 Charge per stack (not during Sworn Vengeance, and not by Avenging Blow). |
| Ledger of Wrongs | Fusion passive: counts the damage each enemy deals the character, reset at the end of their turn (Found Wanting). Simplified: only damage dealt to the user counts. |
| Avenging Blow | New `isPrimary` condition: Wrath if the target is the user's last attacker. |
| Heaven's Rebuke | While it lasts, a skill used by a Condemned enemy it hit adds one more random Weakness, Vulnerable or Confusion. |
| Spear of the Fallen | A `died` signal for one of the user's allies ends the channel and lands 80 Piercing at once. |
| Grounded Point | Simplified: if the user's Charge is full, it fills to 3 again when the timer ends at the start of their next turn. |
| Swift Reprisal | The counter-strike adds the user's Wrath and spends it. |
| Chastening Shock | The Stun lands the next time they use a skill (when Condemned triggers). |
| Spark of Mercy | Uses `energyFromEffect` (Charge turning into energy). |
| Gathering Oath | Simplified: every ally's Charge moves to the user. |
| Arc of Justice | Condemnation is triggered by hand: removed, and a random Weakness, Vulnerable or Confusion applied. |
