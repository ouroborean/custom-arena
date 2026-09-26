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
| Wave of Darkness | The Confusion has no duration, so it's permanent (Q16). See the balance notes. |
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
- **Wave of Darkness is about 84%**, the largest outlier in the game. 25 damage to every enemy every other turn, plus a **permanent** Confusion stack each time (no duration on the sheet, so Q16), quickly makes enemy skills unaffordable. **Recommended fix:** give the Confusion a duration of 1–2 turns.
- Other strong Shadow skills: Shadow Mockery (about 61%) and Spirit Raven (about 59%).
- Weakest: Hall of Phantoms (about 32%), Blinding Powder (about 34%), Touch of Slumber (about 35%) and Nightwrap (about 36%). The bot can't exploit Stealth timing or plan around Blind.

### 19.4 Engine additions for Shadow

- The `stealth` effect flag (Stealth upkeep lives in the pipeline), plus the `nextSkillStealthy` and `randomPrimaryTarget` modifiers.
- Sleep support: `wakes` on damage ops and on `damaged` triggers.
- Taunting to a summoned minion: `from` on `apply`, and the `lastSummoned` selector. Summon ops now return the unit.
- The `stealthFrom` redaction on `skillUsed` events.
