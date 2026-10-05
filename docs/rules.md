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
5. **Exchange** (decided 2026-10-03): once per turn, during their own turn, a player may turn **2
   energy of one color into 1 of another** (the `exchange` command, `checkExchange`). It can't spend
   energy their queued skills need (specific or random), and the opponent doesn't see it (the
   `energyExchanged` event is only visible to its player). Online, the exchange travels with the
   turn bundle and is applied before the queue.

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
8. **Confusion ends when its bearer uses a skill** (decided 2026-10-04; status flag `endsOnSkillUse`). Every stack goes at once. It still raises the cost of that skill and of anything queued with it, and effects that react to the skill ("each skill they use while Confused") still see it. It ends once the skill has resolved or been countered. Confusion applied during that skill, by the skill itself or by a reaction to it (Condemned, Maddening Glass), stays for the next one. A stated duration ("Confused for 2 turns") is now an upper limit. Skills that paid out each time over a Confused window were adjusted to pay once: Offertory gives 2 energy per Confusion, Ebbing Toll heals 10 per Confusion. Crisis of Conscience's window is now a flat 2 turns.

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
| Hot Foot | Checks Ignite **before** the hit. Against an Ignited target, the +2 Might applies to the user's next damaging (non-Strategic) skill, then ends; Strategic skills don't use it up. Otherwise the target is Ignited (no Might). |
| Feed the Fire, Searing Needle | Check **before** the hit. Feed the Fire on an Ignited target removes the Ignite and heals the user 20; otherwise it Ignites. Searing Needle's 10 Affliction needs Ignite or Scorched; otherwise it Ignites. |
| Flamethirst | The ally's next Harmful skill Ignites its targets after it resolves, as the **ally's** own Ignites, so their Flameborn heals from them. Only that one skill. |
| Blisterblade | Counters every Harmful skill for the turn. An attacker who is already Ignited is Scorched instead. |
| Flickerflare | If the target was already Ignited, one random *other* enemy is also Ignited. |
| Heat Seeker | Deals 40 direct damage at the end of the following turn, then Scorches the target permanently. |
| Hidden Explosives, Heat Haze | Each fires once. Heat Haze triggers on **any** skill; Hidden Explosives only on Harmful ones. |
| Dragon Hatchling | HP 30 (placeholder). Its owner's Flameborn is an aura that ends when the Hatchling leaves the board. Its attack Ignites the enemy it hit; that Ignite starts ticking on the owner's next turn. |
| Cinderlings | HP 10 each (placeholder). Both count toward the 4-minion cap. |
| Flashbang | Applies **Stunned (non-Strategic)**, a base status that Swiftness also negates. |
| Ivory Step | Tagged Helpful/Strategic (self-targeted), so it can't be countered. |
| Ashen Barrier | A 20 Shield with no stated duration, so it lasts until depleted. Every enemy (character or minion) whose damage it absorbs is Ignited. |
| Wraith in White | Ignites all enemies first, so its Flameborn heals from those Ignites. |
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
| Pounce | The random energy is added immediately, so it's usable next turn. Prey is checked after the hit; only a target that isn't Prey gets the 1 Toxin (redesigned 2026-10-03 so it builds toward Prey on its own). |
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
| Ascension | Checks Sanctify **before** the hit. With it, the user's Anoint becomes permanent (a timed Anoint they already had is upgraded). Without it, the target is Sanctified for 1 turn (after the hit) and the user Anointed through their next turn; a permanent Anoint they already have stays permanent. **Redesigned 2026-10-03:** it used to do nothing beyond 5 damage without a Sanctified target. |
| Crusade | Condemns if the target is above 75 HP **before** the hit. |
| Martyrdom | Not a counter. When the target next uses a Harmful skill, that skill's targets are permanently Anointed. Fires once. |
| Repentance | Any enemy can be targeted. If they're Condemned when it resolves, they're Stunned for 1 turn and keep their Condemn; otherwise they're Condemned for 1 turn. **Redesigned 2026-10-03:** it used to require a Condemned target. |
| Sacred Lion | Roar (W) and Claws (r) have no cooldown; the sheet gives none. Roar's Sanctify is permanent. |
| Divine Blessing | Blessing from Above (W) Anoints permanently, then the minion dies. |
| Gleam | The Taunt ends when the target uses a Harmful skill. The Condemn resolves on their next skill of any kind. |
| Excoriate | Checks each enemy separately: Sanctified ones are Condemned for 1 turn, the rest Sanctified for 1 turn. Bypass lets it reach Invulnerable enemies. **Redesigned 2026-10-03:** it used to do nothing to un-Sanctified enemies. |
| Grand Crusader | The Sanctify lands after the hits, so the user's own hits don't heal them. The 2 Might and 2 Armor (3 turns) don't depend on the enemies. **Redesigned 2026-10-03:** it used to give 1 Might and 1 Armor per Sanctified or Condemned enemy hit. |

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
| Iceform | Puts a watcher on each enemy for 1 turn: an enemy whose Harmful skill targets the user (single or AoE) is Numbed when they use it, **before** it resolves, so Frostborn blocks that skill's Debuffs. Its damage still lands. |
| Shardstorm | 25 Piercing to each enemy that's Frostbitten before the hit; 10 Piercing plus 1 turn of Frostbitten to the rest. |
| Boreal Dance | 10 damage to each enemy plus 10 per Frost debuff they had. Enemies that had none are then Chilled and Numbed for 1 turn. |
| Glacial Sweep | If the primary target had a Frost debuff **before** the hit, a random other enemy also takes 25. |
| Boreal Aegis | Frostborn plus a 1-turn Chill on every enemy makes the ally immune to all enemy Debuffs for that turn, so its cooldown went from 1 to 3 in the 2026-10-03 redesign. |
| Frost Giant | Chills all enemies for 2 turns, then gives Frostborn for (missing HP ÷ 15, rounded down) turns, minimum 1. |
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
| **`requires`** | A generic skill condition: the skill can't be queued unless it holds, and it fails (no cooldown, no refund) if it stops holding before the skill resolves. Water's Tidal Arrow and Deluge used to require Flow; since the 2026-10-03 redesign no Water skill does. |
| **Extending Stuns** | "Extends Stuns by 1 turn" adds 2 internal ticks (one full round) to every Stun effect on the target, including non-Strategic stuns. This uses the new `extendEffects` op. |

### 15.2 Skill rulings

| Skill | Ruling |
|---|---|
| Waterfall | Reduces every **other** skill of the user by 1 remaining cooldown; Waterfall's own new cooldown is untouched. |
| Surge | The user gets a one-shot Buff: the **next** Renew they apply (to anyone) gets +2 stacks. The Buff is then used up. Surge's own 2 Renew is applied before the Buff exists. |
| Riverbend | Counters Harmful **Strategic** skills used on the user for 1 turn. Every counter grants Flow. Non-Strategic attacks go through. |
| Coordinated Shot | Checks Mark **before** the hit (which consumes it for 10 extra damage), then Marks the target. Flow only if they were already Marked. |
| Tidal Arrow | Works like Snipe (delayed, interruptible, hidden target). The user gains Flow only if the shot lands. |
| Deluge | Checks Flow before the hit. With Flow it consumes the Flow to stun non-Strategic skills; without it the user gains Flow. So on its own it alternates between the two. |
| Whirlpool Trap | For 2 turns, every Strategic skill the target uses (Harmful or Helpful) gives them 1 Confusion. It's visible. |
| Rainbow Scale Fish | Shimmer has no cooldown. It checks the ally's Renew after adding its own 2, so an ally with 1 or more Renew gets Flow. |
| Drink Deeply | Removes Renew from **every** allied unit, including minions and the target, then heals the target 10 per stack removed. With no allied Renew, the target gains 3 Renew instead. |
| Shell Knife | Checks the user's Renew before the hit: 25 at 3 or more stacks; otherwise 10 and the user gains 2 Renew. |
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
| Undying Fury | Hits = 1 + (missing HP ÷ 25, rounded down), counted before the first hit; each 10 picks a random enemy again. Then Immortal for 2 turns. It doesn't touch Soul Fragments. **Redesigned 2026-10-03:** it used to consume fragments and do nothing without them. |
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
| Soul Colossus | 2 Armor and Immortal for 2 turns, plus a watcher for as long: the first time each turn that an enemy damages the user (direct or not), the user gains a Soul Fragment. A Horrified user gains none. **Redesigned 2026-10-03:** it used to consume fragments and do nothing without them. |

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
| Blink | Targets any enemy: 5 damage and +1 Sapped, then the user is Invulnerable for 1 turn (redesigned 2026-10-03; it used to need a Sapped target). |
| Static Elemental | If the summoner has Charge, 1 Charge becomes the Elemental's permanent Might (`onSummon` + the Unholy `removeStacks` op). |
| Lightningrod | Channels until interrupted. It grants a Stormborn linked to the channel (Unholy's `linkTo`). If the user already has Stormborn (e.g. Overcharge), that one is kept with its own duration. |
| Stun Baton | Checks for 80+ HP **before** the hit and 40 or less HP **after** it. |
| Hologram | Harmful, Strategic, and targets all enemies. Enemies **already Sapped** when it resolves get the (visible) Hologram mark: for 1 turn their Harmful skills are countered. The others share a Hologram Decoy: the first Harmful skill any of them uses is countered, its user gets +1 Sapped, and every Decoy ends. Each counter makes the caster Untargetable for 1 turn (redesigned 2026-10-03). |
| System Shock | Stuns non-Strategic skills for 1 turn, or 2 if the target was Sapped before the hit. |
| Signal Boost | 25 to the target and +1 Charge to them, then 10 per Charge to every Charged ally, which includes the target. Charge isn't consumed (redesigned 2026-10-03). |
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
| **Leap** | "X Leaps" means Invulnerable for 1 turn, plus **Leaping**: +5 to direct damage. Leaping lasts until one of the bearer's skills has dealt direct damage and resolved, or until the end of the bearer's next turn (`ownTurns: 1`, 3 ticks when granted on their own turn; decided 2026-10-03): one chance to act with it. Every hit of that skill gets the +5. A new Leap replaces the old Leaping, so "Leap again" (Air Bullet) spends one and grants a fresh one. |
| **Mobility buffs** | Swiftness, Rushing and Leaping. "Removes all Mobility buffs" (Sap Speed, Headwind) removes all three. Leap's Invulnerable isn't a mobility buff and stays. |
| **Immobile** | A **character** (never a minion) with no Charge, Maneuver, Mislead or Dance skill and no mobility buff. It's computed live, like Poison's Prey. It uses the new `hasSkill` condition, and the client shows an **IMMOBILE** badge while any Wind skill is in play. |
| **Stunned (Strategic)** | New base status for "stuns their Strategic skills" (Buffet). Swiftness negates it like the other stuns. Water's stun checks (Drown, Undertow, Whale Call) now count it too. |

### 18.2 Skill rulings

| Skill | Ruling |
|---|---|
| Leaping Strike, Spiral Crash, Air Bullet, Spiral Burst | Check Leaping **before** the hit. Spiral Crash's +10 AoE also hits the primary target. Air Bullet (cooldown 0, was 1) is 5, or 15 (+5 from Leaping) while Leaping, which spends the Leap; otherwise the user Leaps after the hit, so its next use gets the bonus. Spiral Burst is 20 to all, 30 (+5 from Leaping) while Leaping; otherwise the user begins Rushing after the hit (both redesigned 2026-10-03). |
| Airknife | Checks Rushing before the hit: 20 while Rushing (its Stab bonus), otherwise 10 and the user begins Rushing afterwards (redesigned 2026-10-03). |
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
| Shadow Crash | 15 to the target and 10 to each other enemy, then a fresh Stealth for the user (replacing any older one), so its own non-Stealthy use doesn't end it. **Redesigned 2026-10-03:** it used to spend allied Stealth for its damage. |
| Long Shadow | Stealthy. It gives a one-shot buff that makes the user's next skill count as Stealthy. |
| Mirage Blade | Invisible. Counters the first Harmful skill used on the user within 1 turn. The Focus has no duration, so it's permanent (Q16). |
| Shadow Spine | 15 Piercing, then Isolated for 1 turn (through the enemy's turn). Cooldown 1 (was 0), so the Isolation can't be kept up on one enemy every turn. **Redesigned 2026-10-03:** it used to deal 5 Piercing per Blinded, Isolated and Sleep. |
| Dream Seeker | Not Channeled, since the sheet doesn't say so, and so not interruptible. 35 damage a turn later with Bypass, and it doesn't wake a Sleeping target. |
| Dream Chains | Visible. If the target uses no skill during their next turn, they take 15 indirect Affliction and fall Asleep for 2 turns. |
| Spirit Raven | Fel Swoop heals the Raven itself. Blackwing's Taunt points at the Raven. |
| Wave of Darkness | **Changed at the user's request (2026-09-26):** the Confusion lasts 1 turn. The sheet gives no duration, which made it permanent under Q16 and an 84% outlier. |
| Drink Darkness | 5 Affliction to all enemies. Each Blinded enemy then loses Blind and takes 10 more Affliction. If no enemy was Blinded, a random enemy is Blinded for 2 turns instead. |
| Backstab | "The last enemy to damage the user" is whoever last damaged them, by any damage, direct or not, at any time. It's checked before the hit; if nobody has damaged the user yet, the 20 applies. **Redesigned 2026-10-03:** it used to need the user Stealthed or the target Blinded. |
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
| Worldmarch | Kills all allied Seedlings and summons that many Worldsprouts (up to the cap). With no Seedlings, it creates 2 Seedlings instead (redesigned 2026-10-03). |
| Worldcaller | Channel for 4 turns: one Worldsprout at the end of each of the user's turns. Vitality Transfer kills the Worldsprout and heals **another** ally for its HP at that moment. |
| Stonepierce | 20 against a target with Armor or any Shield with value left (new `hasShield` condition). |
| Stone Drill | +20 if the user's Armor stacks plus Might stacks total at least 3. |
| Pitfall | Visible. For 1 turn, the target's Harmful skills are countered, and each counter Stuns and Isolates them for 1 turn. |
| Earthwrap | The enemy's 25 Shield is permanent until depleted (Q16). It's a 2-turn Stun. |
| Landslide | Each use adds a 10-point "Landslide" Shield. If one was already up, the user also creates a Boulder. |
| Infuse Earth | Free, no cooldown. Randomly 1 Might or 1 Armor, both permanent. |
| Worldmute | Targets an **ally** (intentional, GDD §14.2). The ally first gains 1 Might for 4 turns; then for each Might stack on them, a random enemy (re-rolled each time) gains 1 permanent Weakness (redesigned 2026-10-03). |
| Earth Pillar | For 1 turn, damage from a Boulder (a launched one) Stuns the target for 1 turn. |
| Vine Whirl | 5 to all enemies, then launches a random allied Boulder if there is one; if there was none, it creates a Boulder (redesigned 2026-10-03). |
| Awakener's Roar | Creates a Boulder first (if under the minion cap), then every allied Boulder gains 1 permanent Armor and heals to full (redesigned 2026-10-03). |
| Rampart | With any Shield up, every Shield effect on the user is doubled (new `scaleShields` op). Otherwise it's a new 30 Shield, permanent until depleted. |
| Ancient Grudge | A permanent Taunt (inline, forcing targeting onto the user). Using it again moves the grudge: it's removed from all enemies first. |
| Treant Form | Creates a Seedling and a Boulder first (each only if under the minion cap), then counts: Might equal to the Seedling count and a Shield of 5 per Boulder, both for 4 turns (redesigned 2026-10-03). |

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
| **Dragonfire** | Rides on an Ignite: a unit with Dragonfire always has an Ignite too, so every "if Ignited" check anywhere still sees it. While both are on a unit, the Ignite is silent and Dragonfire burns for 10 Affliction at the end of its applier's turn. If the Ignite is removed, the Dragonfire goes out at its next tick. Removing Dragonfire alone leaves the Ignite. |
| **Hoard** | The passive Wyrm's Heart (every Dragon character): each time an Ignite or Dragonfire the character applied deals damage, they gain 1 Hoard (max 6, merging). This lives in Fire's `burn_aftermath` macro, which Ignite and Dragonfire run after each burn. Hoard's Armor is computed from its stacks (1 per 2; 1 per Hoard during Elder Wyrm) and only reduces Normal damage, like Armor. |
| **Breath** | A macro: the bonus is 5 × the user's Hoard, then all Hoard is removed, before the damage lands. |

| Skill | Ruling |
|---|---|
| Tail Sweep | Only the target is damaged. Each of their allies with any Buff loses one at random (one effect, all its stacks); 1 Hoard per Buff taken, so an ally with none gives nothing. **Redesigned 2026-10-05 (again):** it used to be Smash plus a channel-breaking Dragonfire rider, then a 20/10 Smash with 1 Hoard per hit. |
| Dragon's Descent | The Ignite lands after the 15. Until the user's next skill resolves, each enemy its direct damage hits that is Ignited at that moment gains Dragonfire (the user is the applier). An Ignite that skill applies after its damage isn't upgraded. **Redesigned 2026-10-03:** it used to upgrade only Ignites the next skill applied. |
| Dragon's Toll | Gains Hoard equal to the countered skill's listed cost total. |
| Skyfall Breath | The circling user is Untargetable by enemies (Bypass gets through) until it lands or is interrupted. |
| Gilded Bait | The first Buff gained is ended at once. **Simplified:** the Dragonfire it gives can still be removed. |
| Burning Wake | While it lasts, the user's Ignites and Dragonfire also burn at the start of their bearer's turn. |
| Wyrmbolt | The target's Ignite (or Dragonfire) burns twice at once, each burn counting for Hoard and Flameborn. |
| Dragon Egg | The egg has a 3-turn Hatching timer. If the egg is alive when it runs out, a permanent Wyrmling appears and the egg is removed. |
| Molten Maw | **Simplified:** any indirect damage the target takes while Ignited counts as their Ignite burning. |
| Covetous Eye | Placed on every enemy. **Simplified:** each enemy's first qualifying skill is countered, not only the first one overall. The thief gains 1 energy at their next generation, and the robbed player generates 1 less at theirs. |
| Warming Wings | Each burn heals the user's ally with the least HP (the user included) for the damage dealt. |
| Devour Embers | Devours first (every Ignite and Dragonfire on the enemy side), then hits and Ignites the target, so the new Ignite survives until a later use. **Redesigned 2026-10-03:** it used to do only 5 damage with no Ignites around. |
| Wyrmfire Torrent | Each tick: 10 to every enemy, 15 to those with Dragonfire, then one random enemy without Dragonfire gains it (Ignited first). A newly given Dragonfire first burns at the user's next turn end. **Redesigned 2026-10-03:** it used to deal 20 only once every enemy had Dragonfire. |
| Fang | Bite, then tear: with no fang of the user's in them, 5 damage and a 2-turn fang; with one, it's torn out for 25 and 1 Hoard (and signals the Stab bonus). Another Dragon's fang doesn't count. No HP threshold. **Redesigned 2026-10-05 (again):** it used to be Stab plus Ignite-or-Dragonfire, then 10 plus a delayed 10/20 burn. |
| Dragonfear | Its own 2-turn Sleep (counts as Sleep, so Swiftness negates it). Damage that wakes them ends it first, then they Explode, so the Explosion can't set it off again. Running out causes nothing. **Redesigned 2026-10-05:** it used to be Stun plus a delayed Explosion. |
| Hearthfire | Spends up to 3 Hoard, one at a time, for 10 healing each. |
| Dragonblood | The ally's direct damage to enemies Ignites the target (the ally is the applier), or adds Dragonfire if they're already Ignited. |
| Slag | Removes the base Armor and Shield statuses. Shields from other skills stay. |
| Pyre Brand | The Scorch and a 1-turn marker are applied together. When the marker ends, the target Explodes if still Ignited. |
| Dragon's Slumber | The user Sleeps for up to 3 turns. At the end of each of their turns while asleep, all allies heal 20. Waking ends it. |
| Wildfire Wing | Redesign (2026-10-05, final round; was Scything Wing): the 15 lands, then the target gets Dragonfire (Ignited first), then the first spread happens at once: a random other enemy (minions included) is Ignited, or gets Dragonfire if already Ignited, so it burns as that turn ends. A Wildfire (until the end of the user's next turn), applied after that Dragonfire, only primes as the turn of use ends; at the end of the user's next turn, after the Dragonfire has burned, it spreads once more if the target still has Dragonfire (anyone's). Two spreads in all. Spread Ignites/Dragonfire are the user's (Wyrm's Heart Hoard) and permanent like every Dragon Ignite. |
| Furnace Hide | Redesign (2026-10-05, final round): the random enemy can be any enemy unit; it gets Dragonfire (Ignited first) and Banked Fire (Neutral, 2 enemy turns). While Banked Fire lasts, that unit's Dragonfire (anyone's) doesn't burn, and its Ignite doesn't either (Dragonfire replaces it). Banked Fire ticks at the end of the user's turns: 15 Shield for 1 turn to the user while the unit still has Dragonfire. When it runs out, the unit loses its Dragonfire and Ignite (a cleansed Dragonfire stops the Shield and leaves nothing to remove). |
| Wyrm's Domain | Placed on each ally. Every Harmful skill aimed at one of them by an enemy the user hasn't Taunted deals that enemy 10 damage, once per ally targeted. |
| Elder Wyrm | Gives 3 Hoard first (up to the max of 6). Hoard gives 1 Armor per stack while it lasts. **Redesigned 2026-10-03:** it used to give Flameborn instead of Hoard. |

### 21.2 Crystal (Ice + Ice)

| Term | Ruling |
|---|---|
| **Brittle** | Max 3, merging. +5 direct damage taken per stack. When a direct hit lands on a unit with 3, it Shatters them: Brittle is removed, then 20 more (indirect) damage and Shattered for 2 turns. **Simplified:** Brittle doesn't count as a Frost debuff for other kits' checks. |
| **Diamond** | New `maxHpLossPerHit` modifier: no single hit takes more than 15 HP, counted after Armor and Shield (ticks included). It tracks what it prevented in the effect's `prevented`. |

| Skill | Ruling |
|---|---|
| Faceted Hammer | Frostbitten, Chilled and Numb each end for 1 more Brittle (Brittle caps at 3). |
| Crystal Quake | The burst counts the target's Brittle after this hit adds 1. |
| Rime Splinter | Their Frost debuffs and Brittle are extended by a turn. **Simplified:** they can still be removed. |
| Hairline Fracture | Tops Brittle up to 3 on the target's first Harmful skill. |
| Crystal Cocoon | No Invulnerable: Diamond is its defense. Only enemy hits that Diamond actually cut give Brittle. |
| Quartz Spike | The Buff that crystallizes is picked at random. |
| Hard Freeze | Chilled → Frostbitten first; a unit that wasn't Chilled has Numb → Chilled. |
| Ice Pick | Removes Frostbitten, else Chilled, else Numb, for 10 more. |
| Harvest Shards | Redesign (2026-10-03): the hit lands first, then 1 Brittle, then all their Brittle (that one included) is removed for 10 Shield per stack. |
| Frozen Gambit | Only a Harmful skill whose printed cost totals 2 or more trips it (random energy counts); cheaper ones pass and leave it waiting. Brittle equals that total, so a 3-cost skill leaves them primed to Shatter. |
| Perfect Form | One effect gives +10 direct damage (2 Might) and −1 cost (1 Focus); Swiftness is separate. A hit of 25+ (HP plus Shield) removes the effect and the user's Swiftness, and Stuns them for 1 turn. |
| Faceted Ward | New `maxHpLossPerTurn` modifier: at most 25 HP lost per turn, ticks included. |
| Diamond Skin | Its own Diamond; on expiry it heals half of what it prevented, up to 30. |
| Fault Lines | Every skill the target uses gives them 1 Brittle. |
| Cold Clarity | Enemies of the target who damage it within the turn become Frostborn for 1 turn. |
| Seeking Shards | The Brittle moves before the second hit, so that hit gets its +5 per stack and can Shatter. With no other enemy, it stays. |
| Glass Harmonic | New `removeShields` op: every Shield effect on every unit ends, then everyone is Shattered for 1 turn. |
| Latticework | The user's 30 Shield; every other ally carries a linked status (new `borrowShield` modifier), so their hits drain it after their own Shields. It ends with the Shield. |
| Crystal Effigy | Each enemy hit on it gives Brittle, not only the Taunted enemy's. |
| Crystal Lance | Each shard hits, then adds its Brittle, so with none to start they take 5, 10 and 15 and end on 3 Brittle (the next direct hit Shatters them). A shard that lands on 3 Brittle Shatters them, and the later shards start again from 0. |
| Breaking Point | The user's Brittle is ordinary Brittle (permanent until Shattered) and comes from the user themself. |
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
| Brine Bolt | Crest counts every Renew stack on the user's side (the user included) as it hits. |
| Swell of the Deep | "Once per turn": once in each turn of the game, either side's. Only Debuffs from enemies, gained while it lasts; Swiftness stops a Stun before this sees it. |
| Ebbing Toll | Each skill the target uses while Confused heals the user 5 per Confusion stack (the description says so directly). The skill gives the 1 Confusion itself. |
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
| Sonic Boom | Redesign (2026-10-05): the Deafen lasts through the user's next turn. The boom is a watcher on the user that fires as their next skill is used (before it lands; not on Sonic Boom itself): 10 indirect damage to every Deafened enemy. Unused by the end of their next turn, it's lost. |
| Storm Snare | A hidden `muteTraps` status: the target's first counter, reflect or Trap fails, and they take 25 and are Deafened for 2 turns. If it runs out unused, they're Sapped. |
| Second Flash | The engine remembers each unit's last skill slot; the new `resetCooldown` `lastUsed` clears it. |
| Thunderbird | A permanent status on the user Deafens every enemy for 1 turn when their Thunderbird dies. Wingclap's echoes give the Thunderbird the Charge. |
| Thundercrack | Redesign (2026-10-05): its own echo is made first, then every Echo on the enemy side (all four kinds, whoever owns it) runs out at once: each lands as it would have, and its owner gains the Charge. |
| Hush | Redesign (2026-10-05): a hidden timer runs out as the target's turn ends (the Deafened turn), and only then is the counter placed, for their following turn; it counters one Harmful skill. Everything it applies is hidden (Invisible skill). |
| Skyquake | The user's Charge is spent first. Each target gets an echo before the next turn, plus one more per Charge, a turn apart. |
| Thunderhead | Strikes every unit tied for the most Charge (3, then 2, then 1); a random enemy if no one has any. |
| Drumroll | Lands only when it runs its full 3 turns: 30 to each enemy, with Resound. Interrupted, nothing lands. |
| Leaking Rend | **Simplified:** at 2 Sapped, the target generates 1 less energy and the Sapped is spent; it can still be removed. |
| Overcapacity | Charged gets a `stackCap` of 5 and pays 2 energy at 5 (instead of 1 at 3) while it lasts. |
| Rolling Hymn | Until the user's next turn, each skill an enemy uses heals all the user's allies 10. |
| Thunder Cage | Redesign (2026-10-05): half damage is `damageTaken` ×0.5 on direct hits (rounded); each such hit puts an echo on its dealer (half of what it dealt after halving, Shield-absorbed part included, rounded up to 5) owned by the user, landing as that turn ends. |
| Challenge Peal | Taunt and its watcher last 3 turns, both linked to a duel marker on the user; the first direct hit on the user ends the marker, which ends only this Taunt (a Taunt from anyone else stays), and its echo (half, rounded up to 5) lands as that turn ends. |
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
| Cloudburst | The two later 10s are held Drifting Damage (2 and 4 ticks), landing as the enemy's turns end, just before the user's next two turns. |
| Gathering Clouds | Each enemy gets a Gathering Storm Debuff (value 0, 5 ticks) as it's cast; each channel tick grows every storm by 15 (`growShield`). Storm and channel both run out at the end of the user's third turn; interrupting stops the growth, but the storm still breaks then (indirect damage: Invulnerable stops it, and cleansing the Debuff defuses it). |
| Evaporate | The second drain is a delayed effect on the user, not a landing skill. |
| Low Ceiling | Wind's Immobile condition now also counts a unit with Low Ceiling. |
| Sleet Squall | On landing, the ordinary Stun goes to the enemy character with the most HP that the user can target (the target or one of their allies). |
| Downburst | Redesign (2026-10-05, fix 3): one per target (`stacking: unique`, a second one refreshes it). It comes down as the target uses their first Harmful skill (35 Piercing, not direct); the skill itself still goes ahead. Helpful skills don't set it off. Unspent, its onExpire deals 20 Piercing as its 2 turns end. |
| Rain Check | New `deferHits` modifier: each hit on the ally (from someone else) becomes a held hit 10 lower, landing at the end of that turn as indirect damage. |
| Lift | Removes any Taunt; a Taunt gained while Aloft is removed at once. |
| Becalmed | New `driftSkills` modifier: the target's skills Drift while it lasts. |
| Cloudbank | Leaps if the Shield is depleted while the user is Rushing. |
| Looming Cloud, Cloud Titan | Their damage drifts in as a held "Drifting Damage" effect a turn later. Cloud Titan marks the last enemy to damage the user. |

### 21.6 Evolution (Poison + Poison)

| Term | Ruling |
|---|---|
| **Evolve** | A skill's stage is its user's use count so far (the `timesUsed` value): Stage I first, II second, III from the third use on. Later stages keep earlier stages' changes. **Not yet shown in the client.** Mutant Fang (its own counter) and Plague Strain (its stacks) cycle I → II → III → I instead, each stage replacing the last. |
| **Engine** | New `lastAttacker` target (each unit remembers the last enemy who damaged it), `moveEffects` op, `protectEffects` modifier (listed statuses on the bearer can't be removed or reduced by other effects; they still expire), and `adaptiveHide` modifier (learned per-skill resistance kept in the unit's counters). |

| Skill | Ruling |
|---|---|
| Mutant Fang | I: 20 Piercing. II: 10 and 2 Toxin. III: 10, and the target's Toxin ticks twice now (indirect Affliction; nothing without Toxin). Then back to I. |
| Primal Stomp | No stages. The splash counts every Toxin stack on the target after its own 2 (anyone's), 5 each, at most 25; a target that can't gain Toxin (Immune) splashes only what it already had. |
| Scent Trail | Evolves. I: the Focus lasts until the user's next skill. III: the other enemy is picked at random among the living others, and gets 1 Toxin at every stage from III on. |
| Molt | I–II react to the first direct hit within the turn; III counters the first Harmful skill instead. |
| Apex Predator | No Immune, no Might. Direct hits only: each marks the enemy with Prey (the status) for 2 turns, after the damage, so the marking hit gets no bonus. The +10 is to direct damage against anyone who is Prey by any route (the mark, Toxin stacks, low HP). |
| Telltale Venom | Poison's Prey condition now also counts any enemy with Toxin while they carry Telltale Venom (until the end of the user's next turn). |
| Barbed Quill | No hit when it lands (the end of the target's turn): the barb is a 3-turn Debuff that deals indirect Affliction at the end of each of the user's turns, 10, 15, 20. A removed barb stops. Fix 3 (2026-10-05): each quill is a separate barb (`stacking: independent`), so a second one starts at 10 and doesn't refresh or deepen the first, and no tick is ever more than 20. |
| Nesting Pit | Counts hatchings in its stacks. Each Larva is the trap owner's (the minion cap applies). The 2 Toxin come only if it runs out with none hatched. |
| Slough Off | Counts the user's Debuff stacks before removing them; the Toxin (1 to 3) goes to their last attacker. With no attacker yet, no Toxin. |
| Brood Parasite | **Simplified:** the Parasite can't be targeted by enemy skills at all; it dies when any Parasite Host dies. Feed targets the host (Affliction 10) and heals the user's weakest ally. |
| Corrosive Glob | Armor stacks become Vulnerable for 2 turns; III removes all Shields for 1 Toxin per 10. |
| Extinction Event | Hits every unit below 60 HP, the user included. |
| Plague Strain | Its stacks are its stage (1 → 2 → 3 → 1), one step per tick at the end of the user's turns; 6 ticks in all. |
| Opportunist | III executes Prey at or below 14 HP; otherwise I–II as written. |
| Paralytic Bite | A 1-turn marker; when it runs out (the end of the target's next turn), they're Stunned through their following turn if they still have any Toxin. |
| Adaptive Hide | While it lasts, each enemy skill that directly damages the user adds 5 (max 15) to a reduction for that skill, for the rest of the match. |
| Regenerate | II removes Toxin for 10 more healing per stack; III repeats the healing at the start of the ally's next turn. |
| Hormesis | Toxin on the ally heals them for its damage (Toxin status hook). |
| Delirium | Prey also counts a Delirious unit with more than 1 Debuff stack (each counts double). |
| Symbiotic Song | **Simplified:** while it lasts, any indirect hit on a Toxin-carrying enemy heals a random ally of the singer 10. |
| Thrashing Tail | Each lash picks a random enemy anew, so one can take several; the Toxin comes after all four. |
| Festering Howl | Counts all the Toxin on the user (anyone's) after its own; if Immune blocks its Toxin, the Intimidation lasts 1 turn. |
| Exoskeleton | Its own Shield status; at the start of each of the user's turns while it lasts, what's left of it grows by 10. |
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
| Thornwall | The Seedling sprouts as the counter fires, on the enemy's turn, and Taunts that enemy through their next turn. |
| Wild Growth | One Seedling on use, then one at each of the user's next turn starts while it lasts (3 in all). The bonus counts every allied Seedling (Treants too, any creator) as the hit lands, up to 4 of them. |
| Ripening Seed | Redesign (2026-10-05, final round; was Thorn or Sap). The seed is a cleansable Debuff whose stacks are its ripeness (1 = nothing yet, 2 = 10, 3 = 25); it ripens as each of the user's turns ends, the turn it was planted included. Only the user's own seed is harvested, before the 5 and the new seed; the burst is a normal direct hit, and the heal is half the HP it actually took, rounded down. One seed per user: after the harvest, the user's seed in any other enemy is removed (no burst, no heal), so alternating targets never harvests a ripe seed; an ally's seeds are untouched. |
| Heartwood Spear | Channels 2 turns with Channel Growth at each of the user's turn ends, then hits for 50. |
| Strangling Roots | Up to 3 Weakness (2 turns each); the 3rd sprouts a Seedling for the trapper. |
| Take Root | The Boulder becomes a Worldsprout in place if it's alive at the start of the user's next turn. |
| Patient Acorn | +10 max HP and 10 healing at each of its owner's turn ends, no cap. Crush deals half its HP. |
| Growing Thorn | A Debuff that ticks at the end of the user's turns, the casting turn included: 2 ticks. |
| Harvest | A random one of the user's own Seedlings or Treants is sacrificed; its HP is added to the 10. With none, the heal is 10 and a Seedling is created after it. |
| Dryad | Not a Seedling: it doesn't Bloom or grow from Channel Growth. Mend can target the Dryad itself. |
| Splinter Spike | **Simplified:** sacrifices a random allied Seedling, not the one with the least HP. With none, 10 damage and a new Seedling, which the next use can sacrifice. |
| Taproot | Against a Stunned target, moves 10 max HP to the user (while their Flourish total is at most 20). |
| Living Screen | With an allied minion: the target's next Harmful skill lands on the user's minions (`redirectDamage` on every allied character that turn; a random minion takes each hit, not the one with most HP). With none: it's countered and the user creates a Boulder. |
| Overgrow | The Stun is bound to its Seedling (`bindTo`) and ends when that Seedling dies. |
| Evergreen | Swiftness when the user has Flourished at all. |
| Graft | A `maxHp` modifier for 3 turns, filled at once. |
| Tangleweed | **Simplified:** the target can't target minions (`targetExclude`); area skills still hit them. |
| Common Root | Every unit on the user's side shares damage evenly while it lasts. |
| Whirling Vines | One Seedling per enemy minion that died to it. |
| Call of the Grove | With no allied unbloomed Seedling (Treants don't count), the user creates one first. Then Blooms every allied unbloomed Seedling and heals every allied minion to full. |
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
| Apotheosis | Redesign (2026-10-05): no Exalted. Direct damage to an enemy heals the weakest ally half the HP it removed (rounded down); each heal the user does, that one included (the text says so), deals half the HP healed as indirect damage to a random enemy (no loop, since that damage is indirect). |
| Spear of Heaven | Redesign (2026-10-05): while it's aimed, each heal on the user's side (from anyone) adds a stack of Gathered Light (max 3) to the user; the hit spends them. |
| Awe | Redesign (2026-10-05): now costs A, cooldown 2. The enemy part Condemns when its 1-turn Stun expires, even if Swiftness stopped the Stun; the ally part's Swiftness lasts 2 turns. |
| Anathema | Redesign (2026-10-05): Debuffs move with their source and remaining time (`moveEffects`). The enemy part pulls them off the user's weakest ally (possibly the user); the ally part sends them to the enemy with the most HP. |
| Sacred Tithe | Counters the enemy's first Helpful skill and casts it as the user on their weakest ally. |
| Seraph | Sanctifies an enemy when a Condemn the Seraph applied triggers (`ownEffectTriggered`), not any Condemn. |
| Revelation | `reveal` with the new `end` option: every hidden effect on the field is revealed and removed. |
| Glory | Exalted for 1 turn plus 1 per enemy below half HP (missing HP more than current), max 3. |
| Harbinger | The user's Exalted is bound to the Harbinger. |
| Unending Light | A 2-turn channel. |
| Unfailing Grace | `protectEffects` keeps the user's Anointed until the end of their next turn. |
| Transfiguration | Each heal the user does is repeated once (doubling it); they can't use Harmful skills. |
| Consecrate | Redesign (2026-10-05): both parts count direct hits only; the Anoint lasts until the end of the hitter's next turn. |
| Karmic Light | Redesign (2026-10-05): after each direct hit the target lands, the unit hit heals 10 (from the user, so it's one of the user's heals). |
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
| Soulgrinder | Redesign (2026-10-05, fix): a Debuff on the target ticking at the end of the user's turns (the cast turn and the next): 10 indirect Affliction to them, 5 to each unit on their side, then `drain_it` on them. Cleansing it or killing the target stops it. |
| Soul Hunt | Redesign (2026-10-05): the first enemy skill hit on the user before their next turn drains a Fragment back (`drain_it` in reverse: the user loses one if they have any, and that enemy gains one). |
| Take You With Me | The last enemy countered carries a 3-tick doom: if the user dies while it lasts, they die too. |
| Atrocity | (Redesigned 2026-10-03.) Immortal for 2 turns with no Fragments needed; meanwhile each enemy who damages the user loses a Fragment to them (`drain_it`). |
| Doom Knell | Each time the target is healed, the channel's remaining time drops by a turn. |
| Damning Shackle | Inverts healing for 2 turns; the first heal also Stuns. |
| Deathless Step | Redesign (2026-10-05, fix): the Fragment comes first (a Horrified user gains none). Meanwhile `maxHpLossPerHit` 0 holds while the user has a Fragment and isn't under Lord of Souls; each damage instance it caps (any type, Shield absorbs first) removes one Fragment. |
| Bone Needle | Redesign (2026-10-05): hurling is a Tithe 1; under Lord of Souls the user can't spend, so it drains instead. |
| Profane Bolt | Redesign (2026-10-05): every Buff application costs 10 raw Affliction (through Shield and Invulnerable); a skill that gives several Buffs pays for each. |
| Soulfire Nova | Redesign (2026-10-05, fix): no Fragments involved; after the damage, every living unit on the user's side (minions included) is Unhallowed for 2 turns. |
| Heartpiercer | Redesign (2026-10-05): the 30 HP check is made after the hit. |
| Cruel Mercy | Redesign (2026-10-05): Immortal is a Buff, so a Horrified (or Buff-blocked) target gets only the 2-turn Stun. |
| Dark Gift | Redesign (2026-10-05, fix 2): a Tithe 1; the ally always gains 2 Fragments, and a Neutral `dark_gift` (independent) on them removes 1 (2 if nothing was spent) when it ends after 2 enemy turns, only if they still have them. With nothing spent (Lord of Souls included), the user loses 15 HP as raw indirect Affliction, leaving at least 1. No Fragment is minted for good. |
| Mutual Ruin | The 25 HP is paid as raw Affliction, leaving at least 1 HP. Costs no energy. |
| Waking Nightmare | **Simplified:** the countered Helpful skill's targets take 20 Affliction (its healing isn't computed). |
| Danse Macabre | **Simplified:** while Confused, the user's skills cost 1 less instead of 1 more (assumes 1 Confusion stack). |
| Borrowed Blood | At the end of each of the ally's next 2 turns, they lose 10 HP (raw) unless they damaged an enemy that turn. |
| Eternal Torment | Each hit that leaves the target at 5 HP or less (their Immortal floor) gives the attacker a Fragment. |
| Black Mass | Allies left at full HP lose 10 (raw) and gain a Fragment. |
| Spreading Agony | Cleave (was Betrayal, then Stolen Life; redesigned 2026-10-05, final round). "Missing" is the target's max HP minus their HP before the blow, plus the HP the blow took, so a killing blow counts in full. 5 per full 20 of it, at least 5 and at most 15, to every living ally of the target (minions included), as direct Affliction, so Shield doesn't stop it. |
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
| Phase Lock | Only the target is interrupted and Banished, until the end of their next turn. A companion effect that stays live while they're gone (like Safe Harbor's) Blinds them as they return, through their next turn. **Redesigned 2026-10-05.** |
| Unfold / Safe Harbor | The payoff is an onExpire on a frozen companion effect, so it fires when Banished ends. |
| Tangled Fates | Each skill the bearer uses gives them 1 Confusion, which Entangled spreads to the partner (one direction, simplified). |
| Pocket Arena | Everyone else, minions included, is Banished for the rest of this turn and the enemies' next. |
| Dark Matter | The user's Blind lasts through their next turn. |
| Unwatched Knife | The old cut is the user's own Debuff on the enemy it hit last (through the user's next turn); knifing a different enemy deals it 10 first, then every cut closes and the new target gets a fresh one. **Redesigned 2026-10-05.** |
| Shear | The hanging 15 is a Debuff on each of the target's targetable allies through the enemy's next turn; the first of them to use a skill (countered or not) takes it, and every other mark ends. **Redesigned 2026-10-05.** |
| Faceless Void | Partner is the ally character with the least HP; Armor and Immune spread through the link. |

### 21.11 Apocalypse (Fire + Ice)

| Term | Ruling |
|---|---|
| **Thermal Shock** | Lives in the fusion passive: when an Apocalypse character gives an enemy a Fire debuff while it has a Frost debuff (or the reverse), it Shocks: 15 Piercing (indirect) and Shattered for 1 turn, once per unit per turn (a `thermal_shocked` marker until the end of the turn). Other units' applications don't Shock unless a skill says so (the Salamander checks its own). |
| **Frostfire** | Counts as Ignite and Chilled (`countsAs`), so Ignite and Chilled checks see it; its own 5 Affliction tick runs Fire's burn aftermath. New `exact` on `has` skips statuses that only count as the key. Frostfire on its own doesn't Shock; any other Fire or Frost debuff added later does. |
| Worldbreaker | "If that Shocks them" is checked before the Frostfire lands (they have another Fire/Frost debuff and weren't Shocked this turn). |
| Coldsnap Dash | The cracked Ignite deals one extra 10 Affliction to each Chilled, Ignited enemy the next skill targets (the dash's own Frostfire makes its target one). |
| Paradox Bolt | "Already had it" is checked before the new Frostfire lands. The paradox Shock ignores the once-per-turn limit, so a target whose refreshed Frostfire also meets another Fire or Frost debuff is Shocked twice. |
| Fimbulfire | "No Fire debuff": no Ignite, Scorched or Frostfire. |
| Splintering Spines | The Frostfire goes to every targetable enemy except the countered skill's user, minions included; the passive Shocks any of them who already had another Fire or Frost debuff. **Redesigned 2026-10-05.** |
| Sleetspark | The spark is the user's own Debuff (through their next turn); setting it off ends it and uses the normal Shock (once per unit per turn). **Redesigned 2026-10-05.** |
| Rimebrand | The Frostbite lands as the Harmful skill is used and lasts through the bearer's next turn. |
| Ragnarok | The cast turn is the first (3 Might now); each turn's buff lasts until the start of the user's next turn. |
| Comet of Ruin | A hidden mark on the target, linked to the channel: gaining a Fire/Frost debuff ends the channel and lands the 45 at once. |
| Rimeflame Salamander | New minion `onDeath` ops (the dead minion is the actor). |
| Twilight Jotunn | The stun is a Neutral, inline effect bound to the Jotunn, so Swiftness and cleanses don't touch it. |
| Equilibrium | Every Fire and Frost debuff counts once (Frostfire is one debuff, though it counts as both kinds for the check). |
| Twin Needle | The Shatter lasts until the end of the current turn, so allies acting after it that turn get it too. |
| Frozen Remedy | A floor of 1 HP while it lasts; a hit that reaches 1 heals 35 at once and ends it. |
| Long Night's Toll | Frostfired enemies' skills get +1 more cooldown on use. |
| Heart of the Glacier | The burst is the Shield's onExpire: it runs only when its time runs out with something left (a broken Shield is gone), as indirect damage equal to what's left (the skill is Strategic), on a random targetable enemy. **Redesigned 2026-10-05.** |
| Twilight Colossus | Shattered is applied before Immune so it sticks; the first enemy the user damages directly on each turn uses up that turn's Shock (counter `colossus_turn`), even if that enemy was already Shocked this turn. |

### 21.12 Alchemy (Fire + Water)

| Term | Ruling |
|---|---|
| **Transmute** | New `transmute` op, recipes by the unit's side relative to the actor (enemy: Might → Weakness, Armor → Vulnerable, Focus → Confusion, Renew → Weakness; ally: the reverse, other Debuffs → Renew). Stack for stack, keeping time left; everything leaves before the new effects land. Stores the stacks converted in the variable `transmuted`. |
| **Catalyst** | `catalyst` (Buff) / `catalyst_debuff` (Debuff), 2 turns. While a skill resolves, its damage and healing on the bearer double, as do the stacks and duration of what it applies (not another Catalyst); the Catalyst ends once that skill has resolved. Triggers firing during the skill count as part of it. |
| Kiln Crash | Redesign (2026-10-05): no splash damage; each of the target's allies gains a 2-turn Catalyst Debuff. |
| Reactive Flask | Redesign (2026-10-05): counters only the first Harmful skill; Transmutes the attacker's Might, Armor, Focus and Renew (other Buffs stay), then gives them Catalyst. |
| Vial Toss | Checked at the end of the user's turns: if the Ignite is gone, they Explode (Explosions hit the user's enemies). |
| Volatile Compound | "They Explode" hits their side (an Explosion caused by the trap's owner). |
| Homunculus | The ally's gain is simplified to 1 Renew. |
| Essence Extraction | Tracked per enemy (`essence_taken`); an enemy's HP is capped at their new max. |
| Slow Distillation | Redesign (2026-10-05): a counter on the user counts the turns brewed; a companion effect releases it (indirect damage) whenever the channel ends: run out, interrupted by a Stun, or broken by another skill. |
| Probing Lancet | Redesign (2026-10-05): compares the target's Buff and Debuff counts (instances) before the hit; the Transmuted Buff is random, and one with no recipe is removed. |
| Splash Potion | Redesign (2026-10-05, fixed the same day): the splash counts the target's Debuffs (each effect once, whatever its stacks) after its own Weakness lands, so it's at least 5 unless that's blocked (Immune); it hits every other enemy, minions included. |
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
| Coronal Slam / Superheated Bolt | Companion Debuffs on Ignited enemies that act each time the Ignite ticks (at the end of the user's turn) and end when it's gone. |
| Coilgun | The shot fires when the user next uses a skill (a companion effect), or when 3 turns pass. Each turn held adds 15. |
| Thermite Seal | Triggers after the heal lands (no pre-heal hook). |
| Heat Shimmer | The extra tick is at the start of the bearer's turns. |
| Star Core / Supercharge | Built on `negateNext` with 99 stacks (with an `if` for Star Core's 3 Heat). |
| Critical Mass | Its Heat comes at the start of the user's turns; Plasma Core skips the Melt Down while it lasts, and its own check runs as it ends (the end of the enemy's 3rd turn). |
| Power Surge | 5 Affliction per energy in the skill's listed cost (not what was paid), on each use. |
| Arc Brand | Counts direct hits from the user's side after it lands; it bursts as it ends (the end of the enemy's turn). The burst is Affliction and gets no Heat bonus. |
| Flare Beacon | +1 Taunt turn if any Heat was vented, and 1 Sapped per 2. |
| Reactor Core | Armor computed live from Heat (−5 Normal damage per Heat). Its +2 Heat stops at 4, so it never sets up a Melt Down on its own. |
| Jumper Sparks | The Charge goes to a random ally character. |

### 21.14 Mechanic (Fire + Wind)

| Term | Ruling |
|---|---|
| **Contraptions** | Minions tagged `contraption` that carry the `contraption` passive: healing received ×0 and the new `immuneToEffects` modifier (Stun, Sleep, Confusion, Renew). Repair is a raw heal, which skips healing modifiers. |
| **Upgrade** | Macro `upgrade` on a unit that's a minion or in a Mech Suit (condition `upgradeable`): if below level 3, +1 `upgraded` (+5 damage per level, Neutral), +10 max HP and 10 HP. |
| Rivet Gun | New target `primaryLastAttacker`: the last enemy who damaged the target. If it's a minion, it's Upgraded ("this turn" isn't tracked). |
| Mortar | The Mortar lasts 2 turns; the channel fires from it if it's still standing when the channel ends. |
| Jetpack | Invulnerable for 2 turns, a can't-act effect for 3 ticks (through the user's next turn), and a 2-turn effect that Explodes (macro `explode`) when it expires. |
| Pressure Cascade | Counts allies who used any skill earlier this turn. |
| Turret Drop | A `paired_turret` whose new `onDeath` Upgrades the other. |
| Drill Bit | A merging Debuff (`drill_hole`, max 2) counts the Drill Bits in the target, from any Mechanic; cleansing it fills the hole. |
| Chainsaw | A third of the target's HP before the hit, rounded down, kept between 10 and 25; Piercing. |
| Overclock | `cooldownTick` 1 while it lasts: each of the user's turn ends takes 1 more off every cooldown, the Overclock's own included. |
| Concussion Grenade | Lands when its 2-tick timer expires (end of the enemy's turn), unless the target used a mobility skill. |
| Tune-Up | A damaging skill that ends the Leap restores it; damage taken removes it. |
| Signal Flare | Simplified: allied minions aren't redirected to the target; each one that damages it is Upgraded. |
| Steam Whistle | A minion already at level 3 isn't Upgraded and loses nothing. |
| Mech Suit | Immune and a Mech Suit Buff (counts as a Contraption, immune to Stuns and Sleep, healing received ×0 so only raw Repair and Upgrade HP get through, can be Upgraded); Upgraded on use and at each of the user's turn starts. When it ends, the user loses every Upgrade level and 10 max HP per level. |

### 21.15 Brimstone (Fire + Poison)

| Term | Ruling |
|---|---|
| **Sulfur / Erupt** | `sulfur` (Debuff, max 4, merging). Macro `erupt`: 10 Affliction per stack to the bearer, 5 per stack to each allied character of theirs, then the stacks become Toxin and an `eruption` signal goes out. Fire's `burn_aftermath` (any Ignite or Frostfire tick) and `explode` (each enemy hit) call it, so Sulfur works with every Fire skill. |
| Brimstone Pit | A Helpful skill the target uses on themselves counts: they're its target. |
| Prey hooks | Acrid Orb (while Marked) and Scent of Cinders (while Ignited or Scorched) are added to Poison's `prey` condition. |
| Brimquake | The extra 10 is Affliction, per Explosion from the bearer's enemies. |
| Burning Downpour / extra ticks | Macro `ignite_tick`: 5 Affliction, and an Eruption if the target has Sulfur. |
| Belching Toad | Moves a random Debuff (not the newest) from a random ally to a random enemy. |
| Stokers | Each Ignites a random enemy with Sulfur (no "most Sulfur" target yet); if none has any, it gives a random enemy 1 Sulfur instead, so the second Stoker Ignites what the first seeded. An Ignite applied at the end of a turn first burns at the end of the next. |
| Hellmouth | A companion effect hears the channel end (`ownEffectEnded`), whether it expires or is broken. |
| Strike the Match | The 40 HP check comes after its own hit. The Explosion is the user's (Fire's `explode`). |
| Sulfur Dance | The Swiftness is linked to the dance; the Explosion is its onExpire, at the end of the enemy's 3rd turn. |
| Asphyxiate | A Neutral, inline stun: Swiftness (keyed to Stun) and Immune (Debuffs) don't touch it. |
| Brimfire Crest | Heals for all indirect damage the bearer deals to enemies; Flameborn's own Ignite healing is skipped meanwhile so it isn't counted twice. |
| Stench of Sulfur | Simplified: Sulfur the user gave that's cleansed away deals its bearer 10 Affliction. |
| Lure of the Pit | The jumped Taunt lasts 1 turn. |
| Consumed by Fire | An inline Ignite (counts as Ignite) for 2 turns: 10 Affliction at the end of the user's turn, the user heals what it dealt, then the usual burn aftermath (Sulfur Erupts, Flameborn). A plain Ignite on the target burns separately. |
| Pit Lord | Each direct hit from an enemy (minions too) gives its dealer 1 Sulfur and an Ignite from the user, which burns at the end of the user's turn. |

### 21.16 Sun (Fire + Earth)

| Term | Ruling |
|---|---|
| **Corona** | `corona` (Buff, merging, 3 turns; gaining refreshes). Gained through macro `gain_corona`, which trims it to 3 (5 during Solar Maximum). It ticks at the end of its applier's turn: 5 Affliction per stack to every enemy, 5 healing per stack to every ally. |
| **Solar Flare** | Macro `solar_flare`: spends all the user's Corona into `flared`. |
| Scorched Earth | Before the hits, every enemy with a Shield has it halved (`scaleShields`); the ones without are Scorched for 1 turn instead. |
| Rolling Sunstone | A 20 HP Boulder-type minion whose `onDeath` Explodes (destroyed, launched or crashed). Its 2-tick Rolling timer crashes it as the enemy turn ends: its remaining HP as damage to the remembered target (from the Sunstone, like a launch), then it's destroyed. |
| Horizon | Rises when its 2-tick timer ends (end of the enemy's turn). Enemies who used a Harmful skill meanwhile are Ignited. |
| Sunflower / Sunseed | Start with 1 permanent Corona (gaining more makes it a normal 3-turn Corona). Scatter Seeds' Seedling is the Sunflower's own. A Sunseed's Corona passes to its creator through `onDeath`, including on expiry. |
| Ripening Vine | Each Seedling casts Channel Earth (as itself), then loses 5 HP. With no allied Seedling (the Sunflower counts), the user creates one instead. |
| Tinder Spike | The user's Ignite is their own (it burns at the end of their turns). |
| Stubble Burn | HP compared after both 15s land; a tie, or no second enemy, sends the fire to the target. |
| Kiln Wall | Each `shieldDamaged` event (each hit it absorbs) gives the user 1 Corona. |
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
| **Rebirth / Ashes** | Rebirth holds the bearer at 1 HP (`hpFloor`); a hit that leaves them at 1 ends it and puts them in Ashes (Neutral: Untargetable by both sides, takes no damage, can't drop below 1). At the start of their next turn, macro `rise` brings them back up to 25 HP (a unit above 25 keeps its HP). Ashes doesn't stop channels. Simplified: a hit leaving them at exactly 1 HP also counts as dying. |
| Firebrand Talon | Not a Kindle. The brand is a unique inline effect (`firebrand` Debuff on an enemy, `firebrand_mend` Buff on an ally, 2 turns) that hears each of the bearer's skill uses (countered ones too) for 10 indirect Affliction or 10 healing; a new brand refreshes the old one. |
| Pyre Plunge | Redesign (2026-10-05, final round): the user burns min(40, HP − 1) as raw Affliction (like Sacrificial Flame); a user who already had Rebirth and burns to 1 HP goes to Ashes. The target takes that much (direct) and each of their allies half, rounded down; at 1 HP nothing burns and nothing is dealt. Then the user gains Rebirth for 1 turn either way. |
| Rising Dive | An inline Buff that counts as Rebirth (2 turns at most). The user's next skill that resolves (a countered one spends nothing) consumes it for 15 indirect damage to, or 15 healing on, that skill's first target; going to Ashes spends it with no bonus. |
| Pyreheart Fury | A `damageDealt` value counts Ignited enemies (anyone's Ignites) as each direct hit lands, before that hit's own Ignite (a `dealtDamage` trigger). |
| Sunfall Lance | Enemy-only. When it falls, the splash hits every other enemy (minions too) of the user. |
| Banked Embers | An inline Neutral effect with Ashes' modifiers but no `rise`: it doesn't count as Ashes, and it ends at the start of the user's next turn with their HP unchanged. |
| Draw the Flame | The difference is measured after the 10 damage (target HP minus user HP), halved and rounded down, at most 25. |
| Cautery Needle | On an ally, removes random Debuffs one at a time (at most 2); each one removed costs 10 raw Affliction, capped to leave them at 1 HP. No Debuffs, no HP lost. |
| Fanned Flames | Each of the pair carries a 1-turn `fanned_flames` Debuff that remembers the other; a direct hit on one deals 5 indirect damage to the other (indirect, so it doesn't chain). |
| Smoldering Nest | Fires when the bearer's damage leaves a unit dead or in Ashes. |
| Phoenix Chick | `onDeath` leaves its creator a 2-tick egg that hatches a Firebird. |
| Eternal Pyre | The channel's stacks set the burn: 5 per stack at each of the user's turn ends (the use's own included), then +1 stack. Broken (Stun or the user's next skill, Q6), it's out. |
| Cinder Shroud | The no-HP-loss modifiers are conditional on the bearer being Stunned, so a Stun negated by Swiftness or cleansed leaves them open. |
| Dance of Embers | Counts each skill the user uses while it lasts (counter `dance_embers`); the burst runs when it expires. |
| Phoenix Blessing | Its own Rebirth (counts as Rebirth) that heals 25 if it expires unused. |
| Cinders of Doubt | `cinders_of_doubt` (3 turns) checks for an Ignite (anyone's) at the end of each of the user's turns, the use's own included; Weakness and Vulnerable last through the bearer's next turn, Confusion until their next skill. |
| Sanctified Pyre | An inline Debuff that counts as Sanctify (for Sanctify checks) without Sanctify's healing; each direct hit adds a stack, and it burns for 15 per stack beyond the first. |
| Second Dawn | New `revive` op and `revived` event: fallen characters on the user's side return with 20 HP and no effects. |
| Cocoon of Flame | Shield and a can't-act effect for 3 ticks (through the user's next turn); what's left heals every ally. |
| Blazing Challenge | Each direct hit on the user from the enemy they Taunted heals every other unit on the user's side 10. |
| Undying Phoenix | Renew stacks = the hit's size (HP lost plus Shield absorbed) ÷ 10, rounded down, but only up to 3 Renew stacks on the user in all (every source counted); each hit's Renew is its own instance. |

### 21.18 Devil (Fire + Unholy)

| Term | Ruling |
|---|---|
| **Hellfire** | Debuff counting as Ignite and Horrified: 5 Affliction at the end of its applier's turn (with Fire's burn aftermath), and immune to Buffs. |
| **Contract** | An inline effect that counts as `contract` (the benefit is applied beside it; its onExpire is the price). Contracts on the user's side are Buffs, except Borrowed Fire's (Neutral, so a Horrified user still owes it); ones forced on enemies (Fine Print, Hellraze, Collect's Debt) are Neutral, so Horrified doesn't stop them. New `expire` op collects early (Collection Day collects twice). |
| **Devil's Ledger** | Fusion passive: when a unit dies holding a Contract this character gave, they gain 2 Soul Fragments; when one dies with their Price on Their Head, the killer's cooldowns drop by 10 and the user gains 1 energy. `eventTargetHad` now takes `effects`. Contracts from the Imp Notary's Offer belong to the Imp, not the Ledger. |
| Devil's Due | One random Buff of each countered user moves to the user (`stealRandom`: stacks and duration kept; a Horrified user can't receive it). With no Buffs, 15 Affliction. |
| Put It on My Tab | New `devils_tab` status (Neutral, counts as a Contract) via `deferHits`: each hit on the user from someone else (ticking included) is held whole; its price, at the end of the user's next turn, is half of it (rounded down) as Affliction. |
| Borrowed Fire | The price is waived if the enemy it hit is dead when it comes due. |
| Collect | The user heals what the price actually deals (no more than the HP the debtor had left); collected early and doubled (Collection Day), it pays and heals twice. |
| Imp Captain | Simplified: only the Captain's own hits gain 5 per Soul Fragment of its summoner. |
| Soulburn | It runs 5 ticks, so it runs out right after its third burn. Its Hellfire is linked to the channel: interrupted, the Hellfire ends too. |
| Pitchfork | The Buff is removed after the hit; Soul Fragments count as a Buff. |
| Soul Snare | Counts Ignite, Hellfire, Frostfire and Scorched on them. |
| Hellbound | Its stun is its own Debuff (`cannotUseSkills` while the bearer has any Hellfire), so Swiftness can't stop it; cleansing the Hellfire frees them. At the start of each of the bearer's turns it decides: a turn right after a Hellbound turn is free, Hellfire or not. |
| Dance with the Devil | Their Ignites also tick at the start of each of their turns. |
| Fair Trade | Only when the enemy has more HP; the transfer ignores modifiers. |
| Pact of Flame | The price is 20 minus all healing received meanwhile (Lifesteal included). |
| Double or Nothing | Its own 1-turn Hellfire lands before the flip. Simplified heads: each Debuff lasts 2 turns longer, and Weakness, Vulnerable, Toxin and Confusion gain 1 stack. Tails: 1 Soul Fragment. |
| Choir of the Pit | Every enemy is Horrified for 1 turn; for as long, each Helpful skill used on a Horrified enemy (any Horrify, Hellfire included) gives a random ally of the user 1 Might. |
| Co-signed Debt | Redesign (2026-10-05, fix 3; was Pyre Swing): the co-signer is a random other enemy unit. The debt is a counter on them, seeded with the 20 as dealt (Shield absorption counts, like every later hit), plus every hit the target takes (any source or type) while their Debtor link lasts; the Contract (Neutral, so Horrified doesn't stop it) is due as the second enemy turn ends: Affliction equal to half the debt, rounded down to 5. A second co-signing while one is open adds to it and restarts the clock. The target dying ends the adding, not the debt. No other enemy: no Contract. |
| Infernal Toll | 5 Affliction per energy in the used skill's cost; free skills pay nothing. |
| Dare the Damned | A Neutral watch on the user: every hit (Shield absorbed included) from an enemy carrying the user's Taunt adds to that enemy's tally; at 30 their Taunt ends. |
| Archfiend | Only direct damage spreads Hellfire, so its burns don't refresh it; Lifesteal also heals for those burns. |

### 21.19 Ritual (Fire + Shadow)

| Term | Ruling |
|---|---|
| **Rite (N)** | An inline Neutral effect on the user that counts as `rite`, with N stacks, remembering the target. Shared triggers: each skill the user uses is one step (two during Dance of Candles); a `rite_advance` signal from the user or their minions is one step; `rite_complete` completes it; gaining Stun, Sleep or Banished breaks it (not while Warding Candle lasts). The last step expires it, and its onExpire is the effect. `clear_rite` keeps one Rite at a time. The skill that starts a Rite doesn't count for it. |
| Acolytes | Acolyte skills send `rite_advance`; Circle of Warding sends `rite_complete`. Chains of Smoke and Dark Liturgy advance it by signal too. |
| Candlestep | A Rite (1): any next skill of the user's completes it (a Ritual Knife then deals its 25). |
| Severing Spark | Simplified: Isolated if the target has no Buffs. |
| Shadowflame Bolt | The user's Blind runs through the end of their next turn (`ownTurns: 1`), so it covers the skills they use then. |
| Rite of Ruin | Enemies count their own skills (`ruin`) from the moment it starts. |
| Candle Offering | Its own 2-turn Debuff on the target, ticking at the end of the user's turns, the one it's used on included (5 Affliction, not direct; the user heals 10 each time). |
| Ritual Knife | 25 if a Rite completed this turn or the user's Rite has 1 step left. |
| Hush of Smoke | Only a direct hit from an enemy sets it off (once). That hit lands; the Invulnerable, applied mid-turn, covers the rest of that enemy turn, the user's turn and the next enemy turn. |
| Cursed Flame | Every skill the target uses counts, Helpful or Harmful, as it's used. The Ignite is the user's (`randomBearerAlly`: never the target; a lone target lights no one). |
| Offering Brand | Redesign (2026-10-05, last round; was Veilbrand). The Rite (2) and the brand on the target are linked: replacing, breaking or completing the Rite ends the brand. Every direct hit on the branded enemy adds its size (Shield absorbed included) to a total kept on the user, so a target who dies still pays out. On completion, the user's character ally with the least HP (the user included) heals half the total, rounded down; the skill that completes the Rite is counted before its own hit lands, so that hit isn't gathered. |
| Cinder Tether | Healing either receives is undone and dealt to the other as Affliction. |
| Rings of Ash | Redesign (2026-10-05, last round; was Invocation). The Isolation is the base 2-turn Isolated; the Rite (1) counts only the user's (and their Acolytes') skills. On completion, each enemy carrying any Isolated at that moment (from any source) takes 10 Affliction; an enemy who shook it off takes nothing. |
| Smokewall | Only when it runs out with Shield left (not direct damage); a depleted Smokewall deals nothing. |
| Effigy | The 15 HP is a raw loss (nothing reduces it); the skill can't be used at 15 HP or less, so it never kills the user. A 2-turn marker on the Effigy runs out with the Taunt: if the Effigy still stands, the user heals for half its HP, rounded down (so an untouched Effigy gives back exactly the 15), and it's destroyed. |
| Candle Colossus | Redesign (2026-10-05, last round). Immune and an HP floor of 1 for 3 turns, with no damage reduction. Every hit counts its full size (HP lost plus Shield absorbed), so hits that land while the user sits at 1 HP add nothing. When it runs out (not if it's removed), every enemy takes 5 Affliction per full 20 counted, at most 30. |

### 21.20 Glacier (Ice + Water)

| Term | Ruling |
|---|---|
| **Icebound** | New `freezeCooldowns` modifier: the bearer's cooldowns skip their tick. It's checked as the turn ends, before durations count down, so a 1-turn Icebound covers the enemy's own cooldown tick. |
| **Meltwater** | New `cooldownTick` modifier: cooldowns tick 1 extra at the end of the bearer's turns. Skills it frees are counted in the unit's `thawed` counter (Spring Thaw reads it at the start of the next turn). |
| New values / ops | `skillCooldown` (the base cooldown of the skill in scope, for Pressure Ridge), `skillsOnCooldown` (Under the Ice, Glacier Form) and `swapCooldowns` (Borrowed Hour; the skill being used is skipped). |
| Crevasse | Simplified: the triggering Harmful skill Icebinds them for 2 turns and raises all their cooldowns by 1 (not that skill's cooldown doubled). |
| Stolen Season | `adjustCooldowns random`: one of the target's skills with cooldown left gains 1; one of the user's other skills with cooldown left (never Stolen Season itself) loses 1. Either side with nothing cooling is skipped. |
| Stolen Thaw | Simplified: 2 turns of Meltwater, not the Icebound's remaining time. A target that isn't Icebound is Icebound for 1 turn instead (redesign 2026-10-03). |
| Meltwater Rush | Redesign (2026-10-03): Meltwater for 1 turn, or 2 if the target has any skill on cooldown (`skillsOnCooldown`); it no longer reads or melts their Chill. |
| Hoarfrost Pick | Redesign (2026-10-05, fix 3): the pick is itself cooling down (cooldown 0 sets 1) as its ops run, so "another skill on cooldown" means `skillsOnCooldown` of 2 or more; the random one excludes the pick. Otherwise the pick's own cooldown rises by 1, so it misses the user's next turn. Meltwater ticks either off as usual. |
| Floe Horn | Redesign (2026-10-05): the grinding is checked at the end of each of the user's turns (the cast turn included), reading the enemy's cooldowns then; indirect damage. |
| Frozen in Time | Simplified: Icebound for 2 turns keeps their cooldowns where they are, and they rise by 1. |
| Calving | The slab sits on each of the target's allies until the user's next turn; the first to use a skill (countered or not) takes 20 indirect damage, and the others lose it. |
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
| Snare of Lights | Fires on the target's first skill (`skillUsed`, consumed): the target and each of their living allies (minions too) are Dazzled. |
| Stray Aurora | Simplified: it's the user's minion (enemies target it normally). It hits a random enemy if the enemies' side has more total HP, else a random ally. |
| Shock Icicle | Simplified: 25 if the target's player has 1 or no energy. |
| Lightshow | Only the target's next skill strobes (`skillResolved`, consumed); the Stun is the ordinary one (Swiftness negates it), and a skill used on the window's last turn still Stuns them for the next. |
| Polar Storm | The +10 is checked as each direct hit lands, before that hit's own Dazzle. |
| Polar Static | Each skill a watched enemy uses gives a random other character on their side 1 Confusion. |
| Ghost Lights | The energy comes in random colors (`gainEnergy`): as many as the countered skill cost, at most 2. |
| Dance of Lights | Simplified: each skill gives 1 Charge, every second one also 1 Swiftness. |
| Color Drain | Each turn they start Dazzled, they're also Sapped. |
| Arc of Lights | The arc goes to a random other enemy. |
| Polar Beacon | A Neutral watch on the user: when an enemy carrying the user's Taunt damages them, a random enemy with no Taunt at all is Taunted by the user for 1 turn. |

### 21.22 Winter (Ice + Wind)

| Term | Ruling |
|---|---|
| **Snowbound** | Debuff: strips Swiftness, Rushing and Leaping when gained, blocks them (`immuneToEffects`), +1 cost on Charge, Maneuver, Mislead and Dance skills. Wind's `immobile` condition now includes it. Winter's Frost-debuff lists include it. |
| Bitter Blow | Simplified: Snowbound if the target currently has a mobility buff. |
| Snowball | Counts consecutive uses by turn number (each of the user's turns is 2 apart). |
| Ice Skate | Redesign (2026-10-05, fixed the same day): no Rushing. The skate ends with the user's next Harmful skill (countered or not) or after 2 turns. Its bonus is 5 per Swiftness stack the user has as each hit lands (any source, so Swiftness a Stun already spent doesn't count); the user's Swiftness is removed once that skill resolves (a countered one leaves it). Only enemies it deals direct damage to are Snowbound. |
| Whiteout | Redesign (2026-10-05, fixed the same day): Immobile is checked as it lands. Only enemy characters count and are hit (minions are never Immobile and are skipped). 60 is divided and rounded down (3 → 20 each, 2 → 30, 1 → 60). |
| Powder Leap | Redesign (2026-10-05): each enemy carries a 2-turn watch; the first Harmful skill (single-target or AoE) used on the user makes them Leap as it's used, so its damage misses them (Debuffs it applies still land), and ends every watch. |
| Great Yeti | New `spendEnergy` op: at the start of each of its owner's turns, 1 random energy, or it dies. |
| Snow Sprites | Redesign (2026-10-05, fixed the same day): one 20 HP Sprite; Flurry is 5 Piercing to all enemies. The melt is the minion's `onDeath`, so it fires whether it's killed or its 3 turns run out. |
| Long Winter | Redesign (2026-10-05): the channel's stacks count its waves (5 × stacks damage); the third wave also Snowbinds every enemy. |
| Snatching Gale | Redesign (2026-10-05, final round; was Turning Gale): a counter. The target's first Harmful skill within 1 turn is countered, and the user gains Snatched Skill until the end of their next turn. After the user's next Harmful skill resolves (not if it's countered), the user casts the snatched skill (the target's last used, Mimic's lookup) as their own on that skill's first target; an area skill hits the user's enemies. Lost if the snatched-from enemy has died. |
| Snow Dance | Uses the `incomingNegated` trigger (their Swiftness stopped a Stun). |
| Rime Mantle | Redesign (2026-10-03): for 2 turns, any damage from an enemy (direct or not) Chills that enemy for 1 turn, so the ally's Frostborn shuts out their Debuffs afterward. |
| Snowbind | Redesign (2026-10-05): a skill used while the bearer is Snowbound (from any source) adds 1 turn to it, up to 3 times within 4 turns. |
| Frostfeather | Fixed (2026-10-05): any two direct hits from the user's side after the Smite (allies, minions, the same ally twice) set the frost: 10 indirect Piercing and Frostbitten for 1 turn. No Stun. |
| Squall | Fixed (2026-10-05): a separate 1-turn Squall Debuff checks for Snowbound (from any source) as it ends, at the end of the target's next turn; the Stun then covers their following turn. Removing either Debuff stops it. |
| Call of the Cold | Redesign (2026-10-05): a Taunt (`forceTarget`) that only holds while the bearer is Snowbound, from any source, for up to 3 turns. |
| Dead of Winter | Healing modifiers ×0 on every unit (raw heals, such as Repair, still work). |

### 21.23 Stasis (Ice + Poison)

| Term | Ruling |
|---|---|
| **Suspended** | New `suspendEffects` modifier, handled like Banished's freeze: the bearer's other effects don't tick, count down or fire turn-start triggers (the bearer still acts and takes damage). `suspended` (Debuff) on enemies, `suspended_ally` (Buff) on the user's side. |
| **Thaw** | Suspended's onExpire runs macro `thaw`: 10 Affliction per Toxin stack at once. The `expire` op Thaws early (Frozen Fang). Cryo Rend, Hold and Frozen Quarry carry their own Suspension (it counts as Suspended), so their riders land with its Thaw, early or not. |
| Frozen Stomp | The splash (5 per Toxin stack, half the Thaw) goes to each allied character of the target when the Suspension ends. |
| Freezing Lunge | Redesign (2026-10-05): the user's next Harmful skill runs macro `thaw` on each of its targets (a Thaw without a Suspension; the Toxin stays). Helpful skills don't use it up. |
| Stopped Clock | Simplified: cooldowns are cut to 0 meanwhile; when it ends, every skill of theirs gets +2 cooldown. |
| Nine Winters | Enemies carry a linked Suspension while it channels; a companion effect makes them all Thaw when it ends or breaks. |
| Chilling Acid | At the end of each of the user's turns, a Toxined target is Chilled (or its Chill extended). |
| Frozen Waltz | Redesign (2026-10-05): the user carries `suspended_ally` for 3 turns, so each 1-turn Might and Swiftness it gives holds until the Suspension ends and then lasts 1 more turn (3 of each at the end). |
| Frozen Quarry | Redesign (2026-10-05, fix): its own Suspension; each direct hit from the user's side (HP lost plus Shield absorbed) is added to the target's counter `frozen_quarry`; when it ends, early or not, they Thaw and then take half the total as indirect Affliction (max 30). Frozen Quarry's own hit isn't counted. The old `frozen_quarry` line in Poison's `prey` condition no longer has a source. |
| Final Thaw | Redesign (2026-10-03): the 1 Toxin lands before the Thaw, so it's counted (10 more), and the stack stays to tick. |
| Icebite | Redesign (2026-10-05, fix): counter `icebite_turn` holds the turn of the user's last use; the build-up is the user's own turns in between (from the battle's start before the first use), at most 3. |
| Hoarfrost Hush | Redesign (2026-10-05; last round: Ir, cooldown 3, so the team-wide Suspension comes at most every 4th turn): the Suspension freezes the new Chill's countdown, so a 4-turn Chill is still there when the Hush is ready again; enemies Chilled at that point gain the Toxin before their new Suspension. |
| Rime Needle | Redesign (2026-10-03): it brings its own Frost debuff (Chilled for 1 turn, extended with the rest). |
| Cold Grudge | Redesign (2026-10-05): any damage the target deals the user counts; the doubled Toxin lands when the 2 turns are up, even if the Taunt was removed sooner. |
| Hold | Redesign (2026-10-05): the Stun lands as the Suspension ends, after this turn's countdown, so it covers the target's next turn. |
| Lingering Frost | Redesign (2026-10-05, fix): on the counter, every timed Debuff on the attacker gains 4 ticks, except Stun, non-Strategic Stun, Sleep and Frozen Sleep; permanent ones (Toxin) are unaffected. |
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
| Hurl the Stone | Legend is counted after the Saga's Legend for this use. The Boulder crumbles by itself (not a kill, so no Saga Legend for it): 1 Legend per full 15 HP, at most 3. **Redesigned 2026-10-05:** it used to be Launch Stone plus a Mythic mode. |
| Horn of the North | Per enemy: one random skill with cooldown left gets 2 more turns (3 if the user is Mythic when it's used); an enemy with none is Intimidated for 2 turns. **Redesigned 2026-10-05.** |
| Jotun Sweep | Saga's Legend for this use comes first, so it always reaches 1 more enemy, 2 with a Legend already banked; each a different one. A use that reaches 3 Legend makes the user Mythic first, so it sweeps everyone. **Redesigned 2026-10-05 (again).** |
| Frozen Rampart | No Shield. The Boulder is brought down to 25 max HP. Until the user's next turn, while an allied minion stands, direct hits on the user are halved (`damageTaken` ×0.5) and a random allied minion of any kind takes raw damage equal to the half that landed; an emptied side means hits land in full, and damage over time isn't split. A Boulder that survives stays. (Fix 2026-10-05: no longer a whole-hit redirect.) |
| Old Feud | A plain Taunt plus a feud mark, 4 turns each. The user's oath hears them gain Mythic: each enemy with their feud mark loses it and its Taunts (simplified: any Taunt) and takes 25. Each use makes its own oath. |

### 21.25 Prism (Ice + Holy)

| Term | Ruling |
|---|---|
| **Refract** | Written into each skill: half strength (damage rounded down to 5) on a random other unit of the target's side, skipped while the user has Lens. |
| **Lens** | Buff gained until the user's next skill (`gain_lens`): direct damage ×1.5, and that skill doesn't Refract. Simplified: healing isn't boosted. |
| Lightspeed | The next skill is free (`freeSkills`) and gets +2 cooldown. |
| Spectrum Ward | The countered skill becomes 15 damage to a random ally of its user. |
| Burning Glass | The Might is checked as each skill is used, so the skill that spends the Lens already gets it; the stacks end with Burning Glass. The cast's own Lens arrives after the cast, so the cast doesn't count. **Redesigned 2026-10-05.** |
| Focal Point | The split hits every other unit on the target's side, minions included; it isn't a Refract, so Lens doesn't stop it. |
| Standing Decree | Its own Trap (counts as Trap); the refracted Frostbite goes to a random other unit of the bearer's side, minions included. |
| Splinter of Light | The splinter ends at the start of the user's next turn and bursts as the skill's delayed (direct) damage; healing that actually restores HP to the bearer removes it first. The 10 goes to a random other unit of the bearer's side, minions included. **Redesigned 2026-10-05.** |
| Afterglow | Simplified: the last skill comes off cooldown, and the user's next skill (from their next turn) costs nothing; no automatic repeat. |
| Hovering Prism | While it stands, the user's direct hits on enemies refract 5 per 10 dealt to a random other enemy (any skill, not only single-target). |
| Colorless Nova | Simplified: a random Buff, not the longest. |
| Converging Light | Counts the target's allies, minions included. |
| Lens of Favor | The Lens is the user's effect, so a watcher on the user (2 of their turns) hears it end; only a Lens spent by using a skill relays, once, to a random ally character other than the target. |
| Glacial Rebuke | A Buff on the user's targetable ally character with the least HP (the user included); only the first direct hit from an enemy triggers it, then it's spent. **Redesigned 2026-10-05.** |
| Dispersion | Each turn refracts to one more random enemy (5 damage and Sanctify each). |
| Harvest of Grace | Redesign (2026-10-03): counts Sanctified enemies after the hit; with none, the target is Sanctified for 2 turns instead. |
| Shattering Awe | Redesign (2026-10-03): a target with no Frost debuff (Snowbound and Frostfire count) is Frostbitten for 1 turn instead of nothing. |
| Diffused Light | Refracts 20 to the ally with the least HP, if that isn't the target. |
| Beacon of Mercy | Compares the weakest targetable enemy with the weakest ally. |
| Frozen Gleam | Simplified: a 2-turn Taunt. |
| Colossus of Light | Direct hits on the user are halved; the amount they take strikes a random enemy. |

### 21.26 Lich (Ice + Unholy)

| Term | Ruling |
|---|---|
| **Phylactery** | A minion (30 HP, 2 Armor) whose onSummon gives its creator `phylactery_bond` (HP floor 1), bound to it. `make_phylactery` creates one or restores it to full; `feed_phylactery` heals it by `feed` or creates one with that max HP. One per Lich is kept by these macros. |
| **Soulfrost** | Debuff (counted in Frost-debuff lists here): direct damage to the bearer gives its applier 1 Soul Fragment, once per turn (a per-bearer turn counter). Winter of Souls and Heart of Ice use their own variants that count as Soulfrost. |
| Chill Stride | The user applies Soulfrost to themselves, so they're its applier: enemy direct hits on them give them a Soul Fragment, once per turn. |
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
| Rime Lance | Redesign (2026-10-05): a hidden watcher on the target until the user's next turn; the first direct hit from anyone deepens their Dusk (macro `deepen_dusk`, so it can strike Midnight). |
| Moonfall | Redesign (2026-10-05; last round: Dusk 3, and the moon deals 20 and 10): the 15 lands first; a hidden watcher goes on before the Dusk, so a Dusk deepened straight to Midnight brings the moon down at once. It lasts until Midnight strikes them, from any source, and falls once. |
| Stolen Hours | The user's side's Debuffs lose 2 ticks; the target's gain 2. |
| Call the Revenant | New target `summonerLastAttacker`: the last enemy who damaged its summoner (else a random enemy). |
| Winter Solstice | Dormant first, then the channel (so the Dormant doesn't break it). |
| Blackfrost Fang | With Dusk on the target it deepens (macro `deepen_dusk`, so it can strike Midnight); otherwise 2 turns of Frostbitten and Numb. |
| Drowsing Waltz | An HP floor of 30 while it lasts; the first hit that reaches it puts the user to Dormant. |
| Hidden Moon | The Stealth it gives is new, so its own use doesn't end it; being Stealthy, it also keeps an older Stealth. |
| Crescent Cleave | Redesign (2026-10-05, last round): the target is cut first, then a random other enemy. Each one's Dusk is read before its hit: 15 + 5 per stack left (any player's Dusk), then that Dusk is removed with no Midnight. One without Dusk takes 15 and gains Dusk 4 (nothing under First Light). |
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
| Overflow | For 3 turns: the ally's single-target skills Soak their enemy targets as they're used (before they hit), +5 to Soaked enemies, and conducting single-target hits. |
| Waterlogged | Each indirect hit on them adds 1 Confusion (max 3). |
| Backwash Lure | Any healing the user receives (not only Renew) strikes the enemy they Taunted. |
| Eelskin Waltz | Modifier `invulnerableTo` with `soaked`: a Soaked enemy can't target the user and their area hits pass them by; Bypass ignores it. Any damage from an enemy, ticks included, Soaks its source. |
| Arc Lash | Status `arc_lash` on both enemies, each remembering the other, until the end of the turn. The arced 10 is indirect, so it doesn't bounce back or conduct; a Soaked target's 25 still conducts as usual. |
| Live Wire | (Redesigned 2026-10-05.) Only the target's own Harmful skill springs it. The Soak lands on every enemy first; the 10 is indirect, so it neither conducts nor gets the Conductor's +5. |

### 21.29 Mist (Water + Wind)

| Term | Ruling |
|---|---|
| **Fog** | New `fogged` modifier, handled in the pipeline after Blind: an enemy single-target skill aimed at a Fogged unit lands on a random legal unit of that side. A redirect onto someone else stamps the Fogged unit's `fog_redirect_turn` counter and sends a `fog_redirect` signal (source: the Fogged unit, target: the skill's user). Fog's onExpire condenses it into 2 Renew; Veiled Strike's variant condenses into damage to the enemy it struck instead (25 if it redirected a skill), and Mercy of the Mist's doesn't condense. Removing Fog (Morning Dew, Veil of Mist) doesn't condense it. |
| Fogbank | The counter goes on every Fogged ally; the first one to fire removes the rest. |
| Mistpiercer | Any damage to the user meanwhile cuts the shot to 30. |
| Choking Fog | Blind's `randomPrimaryTarget` until their first Harmful skill, which also Confuses them. |
| Condensation | Simplified: 20 more healing if the target was healed since the user's last turn. |
| Mist Double | Redesign (2026-10-05, final round): 2 turns. The user's Mist Double effect is a Ward (`warded`) from the Double, bound to it. The Double can't lose HP; after any enemy Harmful skill that targets it resolves (single-target or area), it deals 10 (direct) to that skill's user and dies. Its onDeath (burst, or its 2 turns up) gives the summoner Fog for 1 turn, which condenses as usual. |
| Mistwalk | Redesign (2026-10-05, fix 3): the Afterimage sits on the user, remembering the target, until the end of the user's next turn. The first direct damage a skill of the user's deals to any other enemy (allies' hits don't count) is echoed onto the target as indirect damage: the hit's size (HP lost plus Shield), at most 25. Hitting the target itself doesn't spend it. |
| Dew Shot | Rolls among every living enemy it could target, minions too; landing on the target deals 10, anyone else 20. |
| Dissipate | A listener on the user hears the first `fog_redirect` from them (redirects away from them only) and makes them Invulnerable then, through the next enemy turn. |
| Whisper Knife | A 1-turn Debuff on the target: the first direct hit from the user's side that leaves them at or below 60 HP (checked after it lands) adds 15, not direct. |
| Lost in the Fog | Counters every Harmful skill the target uses that turn. A countered single-target one is then cast by the user, like a reflect, on a random living ally of the target's (minions count); with none, it's only countered. |
| Dewfall Ring | Direct damage the target deals to the user's side; each ally hit gets a Fog through the enemy's next turn. |
| Squall in the Fog | Hits a random enemy (no target choice). |
| Heavy Air | Counts as Cloud's Low Ceiling, which Wind's `immobile` condition checks. |
| Mercy of the Mist | A listener on the user hears every `fog_redirect` on their side, from any Fog. |
| Mistcutter | Redesign (2026-10-05, final round): only the user's own Fog counts (not effects that count as Fog). With it, the Fog is removed (not expired, so no Renew) and every enemy but the target (minions included) takes 15. Without it, a random other enemy (minions included) takes 10, and the user gains Fog until the end of their next 2 turns, long enough to still be there when the cooldown (1) lets them swing again; it condenses into 2 Renew as usual if unspent. |
| Foghorn | Three separate rolls among living enemy characters; each is its own Intimidated stack. |
| Marid Form | Leaping's pattern: a direct hit during one of the user's skills sets a flag; when that skill resolves, 10 (not direct) to a random enemy, once per skill. |
| Voice in the Fog | A hidden `lured` Debuff: the target's single-target Harmful skills land on the user at resolution (§21.56). |

### 21.30 Serum (Water + Poison)

| Term | Ruling |
|---|---|
| **Dose** | A merging Buff (so Horrified blocks it and Immune doesn't): 5 healing per stack at the end of its applier's turn. When the bearer's total Dose reaches 4 (not during Mutagen), macro `overdose`: 10 Affliction per stack, all Dose removed, an `overdose` signal. |
| Prey hooks | Pressurized Dose (while they have Dose) joins Poison's `prey` condition. (Its old Weak Constitution line there is dead: no Serum skill applies `weak_constitution` any more.) |
| Stimulant Binge | Immune to Debuffs and +1 Might each turn (max 3); a later turn without a direct hit ends it with 20 Affliction. |
| Acid Rain | The pooled Dose goes to a random enemy who has Dose (not necessarily the most). |
| Extraction | Radiant: on an enemy or an ally. |
| Fermenting Jab | A `fermenting` Debuff on every enemy through the user's next turn; each Dose tick on them (whoever applied it) adds 1 stack instead of healing, so a stack can grow into an Overdose. Immune enemies dodge it. |
| Tracer Dye | The target's healing (HP actually restored) is tallied from the cast until the shot lands, by a hidden effect that stays hidden when it tallies. |
| Relief Valve | The valve goes on before the Dose, so a cast that tips the ally to 4 is vented too. Vented: they lose all Dose and the 10 Affliction per stack hits a random enemy of the healer; the `overdose` signal still fires. Mutagen still holds it off. |
| Microdose | Ticks at the start of each of the target's next 3 turns. |
| Toxic Injection | Simplified: Toxin also ticks at the start of their turns. |
| Mithridate | Each Debuff (applied or refreshed) is removed as it lands, and the ally gains 1 Dose from the user; a refreshed merging Debuff (Toxin) goes with all its stacks. |
| Side Effects | Redesign (2026-10-05, final round): the 2 Dose come from the user, so like any Dose they heal the target as the user's turns end. For 2 turns, every skill the target uses (Harmful or not, countered or not) adds 1 Dose from the user; reaching 4 Overdoses them as usual. |
| Lashing Spray | Redesign (2026-10-05, fix 3): any healing that restores HP to the target counts (their Dose, Renew, an ally's heal); each of the first two within 2 turns deals 10 (not direct) to each of their allies. |
| Clotting Agent | (Redesigned 2026-10-05.) No Shield. After each direct hit lands, the user heals 5 per Dose stack they have at that moment; indirect damage doesn't set it off. The Dose still ticks as usual. |
| Bitter Tonic | Only direct hits from the enemy the user Taunted move Dose, and only while the user has some. |

### 21.31 Slime (Water + Earth)

| Term | Ruling |
|---|---|
| **Oozes** | Minion `ooze` (20 HP, Slap). Its passive Splits it when it survives enemy damage with 10+ HP and the side has fewer than 4 Oozes: a new Ooze with half its HP appears, it keeps the rest, and an `ooze_split` signal goes out. `make_ooze` creates one with `ooze_hp` HP (if under 4). Its onDeath sends `ooze_died` (and bursts during Burst Bubble). |
| **Engulf** | `engulfed` (Debuff): Stunned, 5 Affliction at the end of its applier's turns, 3 turns; applied from the holding Ooze and bound to it, so it ends when that Ooze dies. `engulf_new` makes an Ooze that Engulfs `it`. |
| Plunging Fist | Simplified: the user's Oozes heal 10 (not just the holder). |
| Slime Roll | Simplified: Rod-of-Domination-style redirect of damage to a random allied minion for 1 turn. |
| Gel Parry | The Ooze has 10 HP per energy the countered skill cost (10 to 40). |
| Gel Snare | The heal is taken back, and an Ooze with that much HP (10 to 40) Engulfs them. |
| Digest | Simplified: a flat 20 Affliction when Engulfed. Otherwise its own 10 HP Ooze Engulfs the target for 1 turn (bound to that Ooze); at the 4-Ooze cap no Ooze is made. |
| Primordial Pool | Counts `ooze_died` signals and re-forms that many Oozes (10 HP) each turn. |
| Slick Shimmy | Simplified: the user's Debuffs are removed at the end of each of their turns. |
| Irrigate / Fertile Silt | Any healing on the ally (not only Renew) counts. |
| Settling Silt | Simplified: Stuns on them can't be removed (Swiftness still works). |
| Quivering Wall | Melts by lowering all the user's Shields by 10 each turn. |
| Gelatinous Giant | Each enemy hit while the user has 20+ HP splits off an Ooze with a quarter of their HP, which they lose. |
| Feeding Glob | Fix (2026-10-05): an Ooze at 40 max HP or more gains no more max HP (it still heals 10). |
| Oozing Cut | Redesign (2026-10-05): the glob ticks at the end of each of the user's turns (like Engulf), the cast turn included, so 2 ticks; a new cut removes the old glob first. |
| Clinging Sweep | Redesign (2026-10-05, final round; was Splitting Sweep). The gel (Gel Coat, a Debuff whose stacks are the hops left) goes on before the 20, so the sweep's own blow splits it at once if it leaves the target with 10 or more HP; otherwise the target keeps the 2-hop coat. Any direct hit, from either side, that leaves the bearer alive with 10 or more HP makes it hop: 15 indirect damage to a random ally of theirs (minions count), who gets a fresh 2-turn coat with one hop left. The hop isn't direct, so it never splits a coat by itself. With no ally to hop to, it just falls off. |
| Quagmire | Fix (2026-10-05; last round: Ir, cooldown 4): an inline Mired that counts as a non-Strategic Stun (Swiftness ignores it, and it counts as Stunned); any damage ends it on that enemy. |

### 21.32 Anointment (Water + Holy)

| Term | Ruling |
|---|---|
| **Unction** | Merging Buff: at the end of its applier's turn, one stack goes to remove a random Debuff (if any) and heal 10 (every ally during Living Font). |
| **Chrism** | Buff counting as Anointed: each Helpful skill its bearer resolves Anoints the other allies it targeted until the end of their next turn. Pilgrim's Rush and River of Grace hook the same moment (Focus, Chrism). |
| Cascade of Grace | Spending Anointed (or Chrism) cuts the other cooldowns by 2 if there are 2+ enemies, else 1. |
| Calm Waters | The counter sits on the user and every Anointed ally; the first to fire removes the rest. |
| Font Ward | Each Debuff the enemy applies to the user's side hurts them 15 and gives its target 1 Unction. |
| Baptismal Font | Its onSummon gives every unit a Debuff immunity bound to it. |
| Scouring Current | Simplified: while the user has Flow, enemies they hit are Shattered for 1 turn (from the next hit on). |
| Turned to Grace | The counter moves every Debuff on the user's side (minions too) onto the countered enemy, then Condemns them. |
| Submission | A mark on the target, and allies who are Anointed deal it 10 more. |
| Holy Oil | Simplified: immune to Debuffs, and each Harmful skill used on them gives 1 Unction. |
| Fervent Unction | Checked at the start of each of the user's turns, after the last turn's stack was used. |
| Font of Penance | Buffs can't land on them (`immuneTo` Buff); Neutral effects still can. |
| Penitent's Sweep | The user's Condemned fires on their next skill, not on the Sweep itself. |
| Shield of the Font | All Unction is spent at once: that many Debuffs removed, 15 Shield per stack for 1 turn. |
| Holy Sprinkle | A random Buff of the target moves to the ally with the lowest HP; only if they have no Buff does that ally gain the Unction. |
| Call of the Font | The Holy Spring is a 20 HP minion with no skills and the Taunt's source, so the Taunt ends with it. Its death (fading counts) gives every allied character 1 Unction, applied by the summoner. |

### 21.33 Blood (Water + Unholy)

| Term | Ruling |
|---|---|
| **Blood Price** | New skill tag `BloodPrice` and modifier `bloodPrice`: the skill's random pips cost 0 energy, and 10 HP each is paid as it resolves (raw Affliction to the user, stored in their `blood_paid` counter). It can't be queued, and fails, if the HP would kill the user. |
| **Hemorrhage** | Debuff, merging, max 5: at the end of its applier's turn, 5 Affliction per stack, then +1 stack. Any healing removes it (not during Hemophilia). |
| Bloodbound Familiar | It has an HP floor of 1, passes the damage it takes to its summoner and heals back to full; healing it heals the summoner; it dies when they do. |
| Blood Elemental | Its max HP becomes what the user paid. Simplified: it doesn't return its HP when it expires. |
| Exsanguinate | Each turn heals the user 5 per Hemorrhage stack on the target. |
| Bloodletting | Counts Debuffs (effects, not stacks; Hemorrhage included) before removing up to 2 at random; the heal then clears any Hemorrhage left. |
| Pale Step | As it's cast, the enemy who last damaged the user (or a random enemy if none has) gains 1 Hemorrhage. `invulnerableTo` bleeding enemies: they can't target the user, and their damage (ticking included) is blocked. The hit that makes an enemy bleed still lands. |
| Bloodletter's Knife | Missing HP is measured after the hit. |
| Red Herring | Watches every enemy bleeding as it resolves (the target included); one bled later isn't watched. Only one counter in all: the first clears the watch from the rest. |
| Crimson Spray | With no other enemy, nothing bursts and the target keeps their Hemorrhage. |
| Blood Doping | The crash is a Neutral inline stun, so Swiftness can't stop it. |
| Blood Chant | Until the end of the user's next turn, the other allies pay their own random costs in HP (§21.56). |
| Quickened Pulse | (Redesigned 2026-10-05, fix 2.) The extra tick re-runs Hemorrhage's own end-of-turn ops (5 Affliction per stack, then +1 stack up to 5) on every bleeding enemy, whoever applied it, when the user's next skill resolves (any skill, not the Charge itself); then it's spent. |
| Clotting Ward | A Neutral `damageTaken` ×0.5 on direct hits (from anyone). The stopped half is measured as the half that landed (±1 from rounding), added up over the turn (a counter on the user, reset by each use): 1 Hemorrhage per full 20. A second Neutral effect ends all the user's Hemorrhage when it runs out at the end of their next turn, after that turn's ticks (fix 2026-10-05). |
| Bloodcurdle | Any healing on them (Renew ticks included) Intimidates them. |
| Open Vein | Moves all of the user's Hemorrhage, whoever applied it, onto an enemy carrying the user's Taunt who damages them. |

### 21.34 Mirror (Water + Shadow)

| Term | Ruling |
|---|---|
| **Reflect** | The engine's reflect intercept, set up per skill. |
| **Mimic** | `castSkill` with the new `lastUsedBy` (the skill in that unit's `lastSlot`) or `eventSkill`, cast by the user at no cost; a copied ally-target skill lands on its caster. Nested casts stop at depth 2, so Mimics can't copy each other forever. |
| Shattered Likeness | Redesign (2026-10-05, fix 3): the gap is measured after the 25 lands (a target it fells counts as 0 HP); each ally of theirs with at least 2 more HP takes half the gap, rounded down, at most 20. |
| Looking Glass | Debuffs an enemy gives the user are copied onto that enemy and removed from the user (new `eventEffect.remove`). |
| Contrary Fury | Weakness and Vulnerable are offset and flipped: +10 direct damage per Weakness, −10 Normal damage taken per Vulnerable. |
| False Reflection / Mirrored Mending | The Helpful skill is countered and recast by the user on their own side. |
| Through the Glass | The HP is set back (a raw heal, ignoring healing modifiers) at the end of the enemies' next turn; it can't save a user who dies first. Debuffs and Stuns taken meanwhile stay. |
| Glintbolt | "Whoever last damaged the user": the last enemy to do so, if still alive; otherwise the target takes it. |
| Mirror Feint | The caught skill is countered and recast by the user (as with Mimic) on target enemy; one that hits every enemy lands on target enemy's whole side. Skills aimed at the user's allies aren't caught. |
| Dark Tide | Simplified: Mimics the last skill of a random enemy character. |
| Changing Places | The HP swap ignores healing and damage modifiers. |
| Mirror Shade | When it dies, its last attacker recasts their last skill on themselves. |
| Hall of Mirrors | Simplified: enemy Harmful skills aimed at the user are Reflected while it channels. |
| Foiled Ambush | Simplified: doubled against Confused or Blinded targets. |
| Hypnotic Reflection | Any damage the user takes, from anyone, ends its Stun (only that one; other Stuns on the target stay). |
| Inverted Echo | New `invertCooldowns`: ready skills go on cooldown 1, cooling ones become ready. |
| Silvered Guard | Only enemies' hits are mirrored, as indirect damage equal to what the Shield absorbed. |
| Face in the Glass | The user's own Taunt comes from the target and lasts as long. The mirrored half is indirect, of the HP the hit took, rounded down. |
| Mirror of the Faceless | New `copyEffects`: the enemy's Buffs are copied once (not refreshed each turn). |

### 21.35 Storm (Lightning + Wind)

| Term | Ruling |
|---|---|
| **Tempest** | The pipeline now broadcasts `used:<element>` for every skill use. Each Storm character's Storm Heart passive hears `used:Storm` from their side (minions included) and gains 1 Tempest (Neutral, max 5); at the end of their turn with no Storm skill used, −1 (not during Song of the Storm). Simplified: Tempest is tracked on each Storm character, not once per team. |
| **Eye of the Storm** | At 5, a Buff: the bearer's next Storm skill (not Storm Warning) also hits every enemy it didn't target for 15, and Tempest drops by 2. Simplified: a flat 15, not the skill's own damage and effects. |
| Squall Strike | Simplified: +5 per Tempest (max +15). |
| Ride the Wind | The gust fires as the user's next Harmful skill resolves (not if it's countered), within 2 turns; the other enemy excludes that skill's primary target. |
| Storm Within | Redesign (2026-10-05, fix 3): fires as each of the user's Harmful Storm skills resolves (not Storm Within itself, not Helpful ones), after that skill's own +1, and only if some enemy wasn't among its targets; with no Tempest left, nothing. The 10 is indirect and skips every target of the skill. |
| Into the Eye | Redesign (2026-10-05, fix 3): Tempest is raised to 3 a point at a time (`gain_tempest`), so nothing past 3. The rule is a hidden Eye Wall on each enemy (linked to the user's Into the Eye, 2 enemy turns): a `targetExclude` (single-target skills only) on the user while their Tempest is 3 or more, rechecked whenever a target is picked. Skills that target all enemies, and triggered or ticking effects, still reach them; it isn't Invulnerable. |
| Spider Lightning | Redesign (2026-10-05, final round; was Downburst): 10 to the target, then one arc per ally of theirs (minions included), in random order, each to an enemy not yet struck. Each arc first spends 1 Tempest (it reads Tempest after its own +1, so at least one arc); with none left, no more arcs. Arcs deal 20, then 30, then 30. An Eye already held fires after it as usual. |
| Thunderhead | Redesign (2026-10-05, final round; was Bolt from the Blue): a Buff on the user (remembering the target) until the end of their next turn. Its own use raises Tempest as usual; from then on, Storm Heart skips the user's Tempest gain while they carry it (the turn still counts as having a Storm skill), and each Storm skill used by the user's team adds a charge (max 3). As it ends, 20 + 10 per charge to the target (direct). Lost if the user dies or the Buff is removed. |
| Knife in the Gale | Redesign (2026-10-05): "the enemy with the least HP" is read after the first cut, among targetable enemy characters, so it can be the target again. |
| Storm Rider / Tailwind | While active, the bearer's non-Storm skills send `used:Storm` too. |
| Summit Strike | Bypassing 25 Piercing on the enemy with the most HP (it can't reach Stealthed or Untargetable enemies). |
| Mending Arc | 25 to the target, 15 to the other ally with the least HP, 5 to the rest. |
| Shearing Gale | Redesign (2026-10-05): counts the skill's own +1 Tempest, so with no other Storm skill it's 25 and 5; "every other enemy" includes minions. |
| Storm Warning | Redesign (2026-10-05): each damaging hit from a Storm skill (a Storm minion's included) Saps the enemy once; non-Storm damage doesn't. |
| Static Lure | Simplified: while Taunted and Sapped, 1 less energy each turn. |

### 21.36 Battery (Lightning + Poison)

| Term | Ruling |
|---|---|
| **Cells** | `cell` (Neutral, merging, max 5, never decays). The Battery Core passive turns Charge gained while at 3 into a Cell (simplified: gaining Charge that reaches 3 also stores a Cell). **Discharge** is macro `discharge`: all Cells spent into `cells`. |
| **Corroded** | Debuff: −10 to every Shield on the bearer at the end of its applier's turns, and immune to Armor. |
| Toxic Circuit | The short-out fires as the overloaded enemy's next skill is used (Helpful or not), before it resolves: 20 from the user to each of their allies, minions included. Unused, the overload ends with their turn. |
| Leech Line | Reads the target's total Toxin (anyone's) at the end of each of the user's turns, the one it's used on included, after that turn's Toxin ticks. |
| Living Battery | The Cells-as-Armor is its own Armor-type modifier (−5 Normal damage per Cell, read live), not Armor stacks, so Corroded doesn't block it. Spending Cells lowers it at once. |
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
| Spear of Reprisal | Redesign (2026-10-05, was Spear of the Fallen): a hidden watcher on the target, linked to the channel; their first direct hit on the user's side ends the channel and lands 60 Piercing at once. A damaging Stun on the user is such a hit, so the Spear lands before the Stun breaks the channel. |
| Point of Reckoning | Redesign (2026-10-05, was Grounded Point): the Wrath arrives as the turn ends, so the hit that earned it doesn't spend it; the next one does. |
| Swift Reprisal | The counter-strike adds the user's Wrath and spends it. |
| Chastening Shock | The Stun lands the next time they use a skill (when Condemned triggers). |
| Spark of Mercy | Uses `energyFromEffect` (Charge turning into energy). |
| Gathering Oath | Simplified: every ally's Charge moves to the user. |
| Arc of Justice | Condemnation is triggered by hand: removed, and a random Weakness, Vulnerable or Confusion applied. |

### 21.39 Reanimation (Lightning + Unholy)

| Term | Ruling |
|---|---|
| **Galvanized** | Buff with an HP floor of 1 while the bearer hasn't been Reanimated (`reanimated` counter). A hit that leaves them at 1 ends it and puts them in Reanimating (untargetable, can't act, takes no damage) until the end of the turn; then macro `reanimate`: back to 30 HP, Reanimated, once per match. Simplified: a hit leaving them at exactly 1 HP also counts as dying. |
| **Reanimated** | Permanent: healing received ×0 (raw heals still work), immune to Renew, 5 HP lost at the end of their turns (Deadhand skips one). |
| Death Current / Chain of Souls | A kill is detected by the enemy dead count rising (characters only). |
| Dead Man's Switch | If the user is Galvanized when it's cast, it Reflects (and spends Galvanized) instead of countering. |
| Galvanic Overdrive | The 10 HP is lost raw (Affliction) as the user's turn starts; Galvanized catches it like any killing blow. |
| Short Circuit | Each Buff is removed as it's gained (applied or refreshed): 1 Sapped per Buff. |
| Bone Zap | The user drains the Soul Fragment when the Mark is spent (whoever spends it). |
| Flesh Golem | Its own once-only HP floor: it returns at 20 HP, Reanimated, on the spot. |
| Necrobolt | +10 per round since the user returned, up to 30 (`reanimated_turn`). |
| Patchwork Revenant | Simplified: always Gnash (no copied skill from the last unit to die). |
| Twitching Dance | Simplified: each direct hit while at full HP or Reanimated gives 1 Charge. |
| Raise the Fallen | `revive` now stamps `revived_turn`; everyone revived this way is Reanimated (simplified: including characters who were Reanimated before). |
| Lure the Living | Simplified: a 2-turn Taunt; the Horrify happens if the user truly dies meanwhile. |

### 21.40 Ion (Lightning + Shadow)

| Term | Ruling |
|---|---|
| **Suppressed** | New `suppressBuffs` modifier: while present, the modifiers of the bearer's Buffs are ignored (Armor, Might, Invulnerable and so on). Simplified: Buff triggers and Shield absorption still work. |
| **Blackout** | Macro `blackout`: a marker on the enemy and `blacked_out` (can't act, effects suspended) on every enemy minion for the same time. Simplified: the bearer's own channels aren't paused. |
| Power Cut | Simplified: until their next skill resolves, they're Numb (can't apply Buffs). |
| Seeker Spark | Hits every Stealthed enemy (Bypassing) and ends their Stealth; otherwise the target. |
| Ion Cannon | Simplified: Suppresses the target for 1 turn as it lands (not only Buffs gained since). |
| Go Dark | The Harmful lock (`cannotUseSkills`, Harmful only) lasts as long as the Invulnerable, covering the user's next turn. |
| Circuit Breaker | The Charge comes only if a Buff actually ended. |
| Jammer | Its onSummon gives every enemy (and their minions) Blackout bound to it. |
| Dark Hum | Counts `energyFromEffect` (Charge turning into energy) on the user. |
| Shutdown | The user's power-down is a Neutral `cannotUseSkills` (even Unstunnable skills) through the end of their next turn, not a Stun: Swiftness can't negate it. Swiftness negates the target's Stun as usual. |
| Hard Reboot | A Neutral effect with both `suppressBuffs` and `suppressDebuffs` through the end of the enemy's next turn (so nothing can switch it off); the 30 comes only if it runs out. The ally's own turn is never covered, so a Stun they carry still stops them (fix 2026-10-05). |
| Dead Zone | Each enemy skill aimed at the ally counts once (an AoE that includes them too). |
| Ghost in the Machine | A random enemy with Buffs is Suppressed; the user copies their Buffs once. |
| Jammed Frequency | Simplified: every enemy skill gets +1 cooldown. |
| Open Channel | Taunt (was Provoking Static; redesigned 2026-10-05, fix 2). The user holds a Neutral `open_channel` for up to 3 enemy turns; the Taunt and a Charge feed on the target are linked to it, so only this Taunt ends. Any Harmful skill the user uses afterwards ends it (Strategic ones too); the feed gives 1 Charge per damage event from the target to the user. |

### 21.41 Faerie (Wind + Poison)

| Term | Ruling |
|---|---|
| **Charmed** | New `charmed` modifier, checked with Blind in the pipeline: the bearer's single-target skill lands on a random other living unit, friend or foe (its `own` option limits it to their own allies; no skill uses that now). |
| Thistledown Hop | The Leap comes at the end of the turn (a 1-tick timer), so the Hop's own hit doesn't spend it. Simplified: the next damaging skill ends it as usual. |
| Prank | Simplified: countered; a random ally of its user takes 15, and its user is Charmed. |
| Wild Hunt | No Immune, Rushing or Might. Once per turn (the first direct hit on an enemy that turn); the Hunt's own 10 is a direct hit by the user, so Might counts, but it can't ride on again that turn. No other enemy, no ride. |
| Elfshot | Veers to a random enemy with more Toxin than the target, if any. |
| Toadstool Circle | The Charm lands after the Helpful skill (on their following skills). |
| Petal Step | +5 per Toxin on the target, minus Leaping's own 5, until the Leap ends. |
| Wisp Bolt | The wisp burns as each skill of theirs is used, Harmful or not. |
| Dust Storm | Charmed until each enemy's next skill, for up to 2 turns (§21.56). |
| Changeling's Bargain | Random Debuff and Buff (not the newest). |
| Enchanted Slumber | Its own Sleep (counts as Sleep): each hit takes 2 ticks off it instead of waking them. |
| Fey Mark | For 1 turn, each ally of the target who uses a Helpful skill on them is Charmed for 1 turn (§21.56). |
| Fae Laughter | A skill an enemy uses marks each of their allies (Giggling); at the end of each of the user's turns while it lasts, a marked enemy loses the mark and gains 1 Confusion through their next turn. It comes at the user's turn end, so it never makes skills already queued fail. It lasts 2 enemy turns, so one round of Confusion comes (it was 3 turns and two rounds). |
| Gossamer Veil | Each enemy who hits its Shield is Charmed for 1 turn (§21.56). |
| Fairy Wings | Negates Stun and partial Stuns (not Sleep); each negation Charms the ally for 1 turn, and it never runs out of negations. |
| Glamoured Feint | Redesign (2026-10-05, fix 3; was Bewildering Petals): the Charm comes first and ends with the target's next skill or after 1 enemy turn. "Each other enemy" is every unit allied to the target (minions too); the target takes the 20 only when there's none. |
| Faerie Queen | Each Sprite lasts 2 turns. The reduction counts her living allied Sprites (anyone's) and applies to any damage type. |

### 21.42 Nomad (Wind + Earth)

| Term | Ruling |
|---|---|
| **Trek** | Neutral, max 3, kept by the Wanderer passive: at the end of the character's turn, if they used a skill in a different slot than on their last turn with a skill, +1 (`gain_trek`, signal `trek_rose`); the same slot resets it (`reset_trek`, signal `trek_reset`); a turn with no skill resets it unless a Pack Camel stands. Endless Journey blocks resets; Colossus of the Dunes freezes it. |
| Engine counters | The engine's own per-unit counters are now also written under the `c:` names content reads (`actedTurn`, `lastSlot`, `thawed`, `blood_paid`, `fog_redirect_turn`, `revived_turn`), fixing Spring Thaw, Veiled Strike, Blood Price payback and Raise the Fallen. |
| Wanderlust | Each Trek gained gives a Might-like Buff that ends when that Trek resets. |
| Sling Stone | Counts the user's own turns between two uses (counter `sling_turn`); never used before counts as the full +15. |
| Haboob | Lands at the end of the enemy's turn: three gusts (20, 25, 30 Piercing), each on a random enemy (minions included) other than the one the last gust hit (hidden `haboob_trail`); with no other left, the rest die out. An interrupted Haboob hits no one. **Redesigned 2026-10-05 (fix 2).** |
| Sweeping Sands | The buried enemy's sand falls on the user's next `trek_reset` (a repeated skill, an idle turn without a Pack Camel, Campfire Song), within 3 enemy turns; Endless Journey and Colossus of the Dunes hold it off. **Redesigned 2026-10-05 (fix 2).** |
| Call of the Caravan | A Debuff on each enemy for 2 turns: −10 to their direct damage against a target that has Trek (anyone's) or Swiftness, Rushing or Leaping as the hit lands. **Redesigned 2026-10-05 (fix 2).** |
| Sinking Sands | Its own Trap (counts as Trap), checked at the end of each of the user's turns against the bearer's last turn: the same skill slot as on their turn before sinks them; a turn with no skill breaks the chain. Their turn before it was set counts. It lasts 3 of the user's turns, so a repeat on the enemy's 3rd turn is still caught. |
| Dune Leap | The other ally is a targetable ally character; the +1 Trek is a real rise (`gain_trek`, signal `trek_rose`) on top of the turn's own. **Redesigned 2026-10-05.** |
| Tent Stake | Pinned counts as Low Ceiling (Immobile) and is immune to mobility buffs. |
| Road Toll | A Debuff with +1 cost through the enemy's next turn; the first skill the bearer uses (countered or not) pays it, ending it and healing the user 20. **Redesigned 2026-10-05.** |
| Traveler's Knife | Counts back-to-back uses on the user's own turns (counters `knife_turn`, `knife_streak`); an own turn without it starts over. **Redesigned 2026-10-05.** |
| Pack Mule | Simplified: it returns its stored energy whenever it leaves, killed or not. |
| The Long Road | Ends at the end of a turn in which the user's Trek didn't rise (not the turn it started); the user's other skills don't end it (§21.56). |
| Mirage | Two alternating hidden statuses: one counters, the next lets a skill through. |
| Grit in the Eyes | Its own Stun (counts as Stun); any enemy damage to the user removes it. |
| Waterskin | Ticks at the end of the user's side's turns; the turn it's given doesn't count, and a turn without a skill still uses up one of the 2. |
| Waymarker | Ends early when the user's Trek resets. |
| Rolling Dune | Status `rolling_dune`; each `trek_rose` of the bearer grows it, including a rise at the max of 3. |
| Challenge in the Sand | Only the Taunted enemy's hit ends it: their Taunt is removed and the user Leaps (Invulnerable through the enemy's next turn). |
| Colossus of the Dunes | Counts as Low Ceiling (Immobile) and immune to mobility buffs. |

### 21.43 Angel (Wind + Holy)

| Term | Ruling |
|---|---|
| **Ward** | The doc's Guardian/Guarded, renamed because "Guardian" is a retired word the lint rejects. New `warded` modifier, handled in the pipeline after Blind and Fog: the first Harmful (or Radiant) single-target skill each turn that an enemy aims at a Warded unit goes to the Ward's source instead, if they can be targeted; a `ward_redirect` signal follows. |
| **Halo** | Buff with an HP floor of 1: a hit that leaves the bearer at 1 spends it and heals them to 25 (macro `halo_save`, stamping `halo_turn`). Simplified: a hit leaving them at exactly 1 also counts. |
| Wingstrike | Simplified: Wards the ally with the least HP. |
| Swoop | Any Ward redirect to the user during that turn counts, not only this Ward's; the ally's Rushing arrives as the Ward expires. |
| Quill of Light | Flares after the bearer's next Harmful skill resolves (10 indirect damage); heals the units of the user's side among that skill's targets, after any Ward redirect. |
| Descending Spear | (Redesigned 2026-10-05.) Any Ward redirect to the user while aiming counts (not only these Wards). With one or more, the spear doesn't fall and the user heals 20 per redirect when the aim ends; a hit aimed at the user directly isn't a redirect. |
| Watchful Eye | Simplified: every ally carries a hidden Halo for 2 turns; if it saves them, the attacker is Condemned. |
| Take Flight | Leaping is applied without the Leap macro's Invulnerable, which goes to the weakest other allied character (minions are never chosen). |
| Piercing Feather | Pinned: modifier `targetExclude` (single-target only), checked as they aim, so HP lost after the Stab counts; area skills still reach them, and minions aren't covered. |
| Beam from Above | Heals the weakest ally (the user included) for the whole hit, overkill included. |
| Sweeping Wings | "Last enemy who damaged the user" is their `lastAttacker` (any damage, still alive). |
| Last Trumpet | Redesign (2026-10-05, last round): the base Taunt, from the user, on every enemy for 1 turn. Area and self skills are unaffected. |
| Radiant Challenge | Counts any damage the Taunted enemy deals the user; the second removes Taunt from them. |
| Endless Verdict | Condemnations on them are protected from removal for 2 turns. |
| Heavenly Host | A Halo-like effect on each ally while a Lesser Angel stands; it kills one Lesser Angel to save them. |
| Martyr's Wings | Simplified: the user gains a Halo and Taunts that enemy (no redirect of the skill itself). |
| Wings of Respite | While an ally of theirs has Swiftness, Stuns on the user's allies are negated, each costing the user 1 Swiftness. |
| Fallen Grace | Mobility buffs they'd gain are removed (`eventEffect.remove`) and they're Condemned. |
| Seraphic Form | Each single-target Helpful skill resolved is recast on every other ally (castSkill depth guard applies). |

### 21.44 Ghost (Wind + Unholy)

| Term | Ruling |
|---|---|
| **Spectral** | Buff: Normal damage taken ×0. |
| **Haunt** | Debuff: 10 Affliction at the end of its applier's turn, then macro `haunt_drift` moves it (with any riders: Spirit Mark, Frozen with Fear) to a random allied character of the bearer, if any, and sends `haunt_drift`. Phantom Blade pins it for the turn. |
| Vengeful Spirit | Simplified: the first enemy to use a Harmful skill on the user takes 15 Affliction (Normal damage that passes through deals 0, so it can't be measured). |
| Unfinished Business | Redesign (2026-10-05): each enemy whose direct damage reaches the user is marked with a Grudge (once each, at most 3) and adds 1 Might tied to the Rage; when the Rage expires, every Grudge holder is Haunted. |
| Phantom Pain | The target's allies carry a link: direct damage to them deals the target 5 Affliction. |
| Hangman's Noose | The first Buff they gain is removed (`eventEffect.remove`) and they're Haunted. |
| Steal Breath | A Haunt variant (counting as Haunt) that heals the user for its damage. |
| Reaping Bolt | Redesign (2026-10-05): a plain Haunt; a 1-tick tracker checks, right after the Haunt's own tick, whether it left the target, and drains then. |
| Restless Dead | Redesign (2026-10-05): each wave marks its victim; later waves pick a random unmarked enemy (any enemy once all are marked). |
| Through the Veil | Redesign (2026-10-05): the second hit goes to a random other enemy (minions included); no Bypass. |
| Night Terror | The skill's targets are Spectral for the rest of that turn, then its user is Horrified. |
| Spirit Form | Simplified: each Harmful skill an enemy uses on the ally gives the user a Soul Fragment. |
| Unnerving Touch | Simplified: each Helpful skill used on them gives the user 1 Swiftness. |
| Dirge of Spirits | While an ally has Swiftness, Taunts on them are negated, each costing 1 Swiftness. |
| Keening | Redesign (2026-10-05): checks who was already Haunted before Haunting everyone. |
| Beckoning Spirit | Redesign (2026-10-05): status `beckoner`, one Taunt (`forceTarget`, counts as Taunt) that moves to a random other enemy character at the end of each of the user's turns after the first. |
| Second Haunting | Redesign (2026-10-05): Spectral plus +5 Piercing/Affliction damage taken; the user vanishes (untargetable, no damage) and returns with 30 HP at the start of their next turn. An HP floor of 1 catches the killing blow, so any hit that leaves them at 1 HP (lethal or not) triggers it, as the text says. |
| Phantom Sweep | Redesign (2026-10-05, fixed the same day): the Phantom Blade is a Debuff; it drifts to a random enemy character other than its bearer at the end of each of the user's turns (the turn it's used included), so twice in all, and cuts the new bearer for 15. With no one to drift to, it stays and cuts no one. |

### 21.45 Ninja (Wind + Shadow)

| Term | Ruling |
|---|---|
| **Shadow Clone** | 5 HP minion (macro `make_clone`, at most 3). On summon it gives its Ninja **Substitution** (bound to the clone); on death it sends `clone_destroyed`. |
| **Substitution** | Ward (counts as Warded): the first enemy skill on the bearer each turn is redirected to the Clone. |
| **Flurry** (passive) | Each Harmful skill the Ninja resolves deals each enemy target 5 Piercing per allied Clone (not direct), counted as it resolves. Blur doubles the next one (the passive spends it); Shadow Whirl's hits every enemy. |
| Blur | A Buff with no time limit, spent by the next Harmful skill's Flurry (even one with no Clones left). |
| Second Draw | The new Clone is made before the Flurry, so it counts. At 3 Clones a random one goes. Its stab lands as the enemy turn ends (2 raw ticks), from the user, not as a skill (no Flurry). |
| Quickdraw | The cut is a trigger on the target's next skill use, before it resolves; a target it kills doesn't get the skill off. Otherwise it lands when the 1-turn effect runs out. |
| Whirlwind of Blades | At 3 Clones, each Clone deals 10 to a random enemy (not direct) and is destroyed. |
| Log Trick | Counters; the Clones' strike back is 10 Piercing per Clone to the countered user. |
| Feint | Countering a Harmful skill makes the user Leap (Invulnerable for 1 turn, Leaping). If it runs out untriggered, the user is Marked through the next enemy turn. |
| Hidden Needle | Channel: on natural expiry, the target loses half their current HP as Affliction. |
| Paper Seal | Each Buff gained is shortened by 2 duration ticks (1 turn) and deals 10 Piercing. |
| Pinning Kunai / Track | "Can't gain" uses `immuneToEffects` (Swiftness, Rushing, Leaping / Stealth). |
| Pressure Point | A 1-turn Debuff whose expiry (the end of the target's next turn) applies a 1-turn Stun (their following turn); cleansing it first, or Swiftness, stops the Stun. Fix 3 (2026-10-05): 1 turn and cooldown 2, so one Stunned turn in three at most, as base Stun, but telegraphed a turn ahead. |
| Shadow Dance | While a Clone exists, the user's next skill is Stealthy; each non-Stealthy skill used destroys a random Clone. |
| Cloak of Shadows | Each Clone also Substitutes for the ally for 2 turns (bound to the Clone). |
| Haunting Shadows | The Flurry lands as each skill is used (before it resolves), counting the user's side's Clones then. It isn't the passive, so it fires on Helpful skills too. |
| Shadow Whirl | The Clone comes first. The Flurry passive sends a Ninja Cleave's Flurry to every (targetable) enemy instead of those it hit. |
| Shadow Guard | Base Shield (20) on each allied Shadow Clone, the new one included; the user gets none. |
| Scatter | Each ally targeted by an enemy skill gains Stealth for 1 turn (once per ally). |
| Smoke Bomb | Every character on both sides, the user included, gains Stealth for 2 turns. |
| Mocking Shadows | Counts the Clones on the user's side, destroys them all, then Taunts for 1 + that many turns, at most 3. |
| Shadow Master | Untargetable (bypassable) until the last Shadow Clone on the user's side is destroyed (Clones made later don't bring it back); Immune for the 3 turns either way. |

### 21.46 Spore (Poison + Earth)

| Term | Ruling |
|---|---|
| **Spores** | Debuff, merging per applying side. At 3 stacks, macro `sprout` runs for the applier (a Mushroom) and the bearer loses 3. At the end of the applier's turn, a bearer with 2+ passes 1 to a random ally (`randomBearerAlly`). |
| **Mushroom** | 15 HP Seedling-tagged minion with Channel Earth; its Puff (status `mushroom_puff`) gives a random enemy 1 Spore, sourced from its summoner, at the end of its side's turns, starting the turn it sprouts. Each sprout sends `mushroom_sprouted`. |
| Moldering Fist | "If a Mushroom sprouts" = they had 2+ Spores before the hit. |
| Spore Trail | The trail lasts 3 raw ticks (through the user's next turn). |
| Bursting Cap | Stacks = targets of the countered skill (at least 1). |
| Tainted Hands | Fires when the Helpful skill resolves. |
| Spore Molt | Simplified: one Spore per Debuff effect shed, not per stack. |
| Sporeling | Grows whenever a Mushroom sprouts for its side, from anyone. |
| Binding Hypha | Redesign (2026-10-05): the bound ally is a random other enemy; each carries a 2-turn link remembering the other, so direct damage to either (after the bolt's own hit) gives the other 1 Spore. A lone target isn't bound. |
| Infest | Redesign (2026-10-05): status `infest` on every enemy for 2 turns, a +1 generic cost that only applies while its bearer has Spores (from any source). |
| Carrion Bloom | Redesign (2026-10-05): the Mushroom is created first, so it counts; Seedlings are the user's side's `seedling`-tagged minions; capped at 2 Spores per enemy. |
| Humus Wall | Redesign (2026-10-05): status `humus_wall`, a permanent Shield whose first turn end only settles it; later ones apply the Spore, then shrink it by 10 (`growShield`), removing it at 0. |
| Fungal Colossus | Redesign (2026-10-05): status `fungal_colossus` sprouts with macro `sprout` at the end of each of the user's turns; its Armor is a Normal-damage reduction of 5 per living allied Mushroom, recounted on each hit. Immune for the same 3 turns (fixed the same day). |
| Rooted Rhythm | Simplified: only the user and the minions on the field when it's used are covered. |
| Compost Bed | One random Debuff effect rots (a merging Debuff loses its whole stack); with no Debuff, no Spore. |
| Mycorrhizal Bond | Only damage from enemies warns; each warning is a separate 1-turn Armor stack. |
| Fester Pod / Thorn of Rot | "Already had Spores" is checked before the hit (any side's Spores count). |
| Decompose / Rot Drill | With no Spores on the target, it plants 2 (which may pass 1 on at the end of the turn). |
| Mycelial Network | "If none has any" is checked at each of the user's turn ends, so a cleansed team is reseeded. |
| Cordyceps Brand | Healing received ×0.5; the same amount heals a random ally of the applier. |
| Fruiting Psalm | Spores the user gives their own allies sprout for the user (the applier rule). |
| Spore Whirl | Simplified: the second target is a random other enemy with Spores, not the one with the most. |

### 21.47 Antidote (Poison + Holy)

| Term | Ruling |
|---|---|
| **Inoculated** | Buff: the next Debuff that lands is removed at once (for a merging Debuff, the whole stack), and the bearer gains **Immunity** to that Debuff's key for 3 turns (op `immunize`, status `immunity` with `immuneToEffects fromData`). |
| **Purge** | Macros `purge_one_to_primary` / `purge_one_to_random` / `purge_all_to_random`: removes a random Debuff (or all) from `it` and deals 10 Affliction per stack removed (value `kindCount … stacks: true`), not direct. |
| Shared Absolution | Status `shared_absolution`: while Sanctified, a direct hit also heals the user's other characters 15. |
| Quickened Venom | Each skill the target uses ticks their Toxin (5 Affliction per stack). |
| Acquired Tolerance | Simplified: the counter Inoculates the user (rather than immunity to each Debuff the skill carried). |
| Immune Response | Modifier `suppressDebuffs`: the bearer's Debuffs neither modify nor tick (their other triggers, like Mark, still fire). |
| Remedy Dart | Simplified: Inoculates the user's most wounded ally. |
| Long Diagnosis | A hidden Neutral counter on the target counts the skills they use during the channel; it reacts silently, so it doesn't give the target away. |
| Countervenom | Simplified: the Debuff is removed and the bearer takes a flat 10 Affliction. |
| Quarantine | Simplified: only enemies who target the user become Prey. |
| Long Treatment | Simplified: a random ally with Debuffs loses one and becomes Inoculated. |
| Find the Wound | Added to the Prey condition. |
| Twilight Sleep | Both are Asleep and Invulnerable for 2 turns. |
| Clean Bill of Health | Simplified: all the user's cooldowns drop, Clean Bill's own included. |
| Crisis of Conscience | Each skill the target uses re-applies Condemned after it resolves. |
| Healing Liturgy | Only Debuffs from enemies; `immunize` gives every ally Immunity to that Debuff. |
| Neutralize | Inoculated turned on an enemy: the next Buff that lands on them within 2 turns is removed at once (a merging Buff loses its whole stack) and they gain Immunity to that Buff's key for 3 turns. |
| Theriac Brand | (Redesigned 2026-10-05.) Not a Sanctify: no healing. Each direct hit from the user's side (the user included, after the brand lands): a random Debuff of the damager's is Purged onto the bearer (10 Affliction per stack, not direct); with none, the damager is Inoculated. |

### 21.48 Blight (Poison + Unholy)

| Term | Ruling |
|---|---|
| **Withered** | Debuff, merging per side, max 5, permanent. Modifier `maxHp -5 perStack`: each stack change moves max HP (a rise also restores HP; a fall caps HP). Cleansing restores the max HP but not the lost HP. |
| **Festering** | Part of Withered: at the end of the applier's turn, a Withered unit that has Toxin gains 1 Toxin. |
| Dread Lunge | Inline Debuff counting as Horrified (no Buff block) until the end of the user's next turn (§21.56). |
| Festering Spite | Simplified: the countered skill's user gains a flat 2 Withered. |
| Plaguecrusher | The splash counts the target's Withered after this hit's stack; a target the hit kills splashes nothing. |
| Bitter Bile | The 3-Fragment check counts the user's Soul Fragments from any source, as it's used; the Toxin comes either way. |
| Rotspear | Redesign (2026-10-05): on landing, the user's Toxin (every stack, applied by anyone) moves onto the target keeping its applier, so it ticks at the end of that unit's turns. Interrupted, nothing lands or moves. |
| Rotten Remedy | The healing lands, then is undone as raw Affliction damage; Withered = healing ÷ 10, rounded down. |
| Seep Away | Simplified: at the start of the user's next turn, their Toxin on each enemy ticks once more. |
| Plague Bolt | `protectEffects: [withered]` while Horrified, for 1 turn. |
| Leveling Plague | The gaps are measured before the lowest-HP enemy is hit. |
| Plague Imp | Its Rotbolt tags targets (`imp_bitten`); when it dies, they Wither. Simplified: only on death, not on expiry. |
| Long Decay | Duration counted when used. |
| Rusted Knife | Redesign (2026-10-05): the hit lands first (the Fragment being spent still adds its +5), then one Fragment is spent for the 2 Withered. |
| Rot Waltz | The first target, if an enemy, Withers when the skill resolves. |
| Vulture's Blessing | Checked when the ally's skill resolves. |
| Touch of Decay | Simplified: Confusion lasts 3 turns, not until the Withered is cleansed. |
| Communion of Rot | Each enemy character loses 15 HP (raw Affliction). Allies heal 2 × the actual total ÷ the number of allied characters. |
| Bone Carapace | When a hit leaves the user with no Shield, the user gains a Soul Fragment. |
| Carrion Stench | Damage taken −10 per hit and healing ×0 until the user's next turn. |
| Plague Lord | Counted when used: an inline Buff with `maxHp +5 perStack`, 1 stack per Withered on enemies. |

### 21.49 Assassin (Poison + Shadow)

| Term | Ruling |
|---|---|
| **Death Mark** | Hidden Debuff whose value is its execute threshold (25; raised to at most 40). A direct hit from an Assassin-element skill (or a Subcontracted ally's skill) from the marker's side deals 10 more, and if the bearer is then at or below the threshold they're executed (signal `mark_executed`). Simplified: one Death Mark per side; placing one (macro `place_mark`) removes any other. |
| Throatcut | "Executes your Death Mark" = the target had it and is dead after the hit. |
| Coordinated Strike | Stealthy; Toxin stacks = Stealthed allies counted before the hits. |
| Stalk | Simplified: the Mark lasts 2 turns, Stealth or not. |
| Garrote Wire | Value `skillCooldown` of the countered skill. |
| Open Contract | `mark_if_none` on use and at each of the user's turn ends, then the Mark's threshold +5 (max 40) at those turn ends, the use's own included. |
| The Long Shot | Executes at 40 HP after the hit if the target carried the Mark. |
| Covering Smoke | The Stealth goes to `weakestOtherAlly`; then Stealthed allies' skills gain the Stealthy tag for 1 turn (so a covered ally who acts extends their Stealth, as usual). |
| Whispered Names | Status `whispered_names` (4 stacks = the original plus 3 passes) goes with the Mark; the first direct hit passes Mark + whisper to a random other enemy. |
| Poison Smoke | A moved Mark resets to threshold 25. |
| Hired Blade | Its killer is the last enemy who damaged it. |
| Open Season | While the channel lasts, the Mark's threshold is at least 35. |
| Stiletto | Threshold +5 (max 40) before the hit. |
| Unseen Knife | Simplified: against a Blinded or Sleeping target, the user gains Stealth for 1 turn. |
| Poisoned Lure | The 2 Toxin come when the Lure runs out untriggered. |
| Knockout Poison | The 2 new Toxin join first; then every side's Toxin on them is counted and removed, for 10 Affliction per stack (at most 30), and a 1-turn Stun. |
| Blowdart | The dose is a hidden Debuff whose 15 Affliction lands when it expires at the end of the target's next turn (revealed then, as an expiring hidden effect is). |
| Blood Debt | The debt sits on the ally's `primaryLastAttacker` and remembers the ally; the first direct hit on it from the user's side within 2 turns heals that ally. |
| Mark for Death | Threshold = 25 + 5 per Toxin when placed (max 40). |
| Serpent's Communion | Gives Evolution's Hormesis for 2 turns. |
| Hidden Mail | A hidden inline Buff: `damageTaken` ×0.5 on direct hits; a flag lets only the first enemy direct hit place your Death Mark (macro `place_mark`, threshold 25). |
| Whisper from the Dark | A Taunt by the user, Stealthy; Taunts are absolute, so while the user is hidden the target has no legal single-target enemy target (§21.56). |
| Guildmaster | Simplified: every enemy gains a Death Mark for 3 turns. |

### 21.50 Sanctuary (Earth + Holy)

| Term | Ruling |
|---|---|
| **Sanctum** | A merging Buff (stacks = level, max 3) on whichever ally raised it first (macros `raise_sanctum` / `lower_sanctum`); raising refreshes it to 3 turns. At the end of its side's turns: every ally gets 1 Armor per level until that side's next turn, heals 5 per level, and at level 3 gains Steadfast (immune to Stuns) for the turn. Level = total `sanctum` stacks on the side. |
| **Wardstone** | Minion (45 HP) tagged boulder and wardstone. While one (or a Living Temple) stands, the Sanctum extends itself by a turn at each of its ticks. |
| Temple Warden | The kit's "Temple Guardian", renamed: "Guardian" is a retired word the content lint rejects. |
| Toppled Idol | HP is compared before the hit; equal HP doesn't count. The 30 lands as one hit. |
| Cracking Foundation | Boulders lose 15 raw HP; +5 per Boulder counted before. |
| Pilgrim's Stride | The Shield goes to `weakestAlly` (the user included). |
| Sheltering Stone | At level 3, every ally gets their own counter. |
| Obelisk | Simplified: +20 if any allied Wardstone stands. |
| Sacred Boundary | Its first direct hit on any of the user's side. |
| Right of Asylum | Simplified: the user's other allies each get a hidden counter for 1 turn (the "no Harmful skill last turn" condition is dropped). |
| Stately Measure | Its Might is a separate capped status `stately_might`; the Might, Armor and Focus are linked to the Dance. |
| Day of Rest | Lasts through the ally's next turn; a Harmful skill removes it. |
| Stone Vow | Simplified: after a hit, the ally heals back half and a random allied Wardstone takes it as raw damage. |
| Excommunicate | Simplified: Isolated for 3 turns, plus Condemned. |
| Holy Harvest | The user heals the HP the target actually lost. The Sanctify is applied after its own hit, so the user's 5 doesn't count; the first direct hit on the Sanctified target makes the Wardstone. |
| Penitent's Awl | A target that isn't Condemned becomes Condemned; one that is resolves it now. |
| Stone Rebuke | A companion Debuff checks, as the Condemned enemy uses a skill, whether their Condemnation fired (`condemn_fired`): if so, 10 (not direct) and the Sanctum rises; if the Condemnation is gone some other way, it goes too. Fix 3 (2026-10-05): Ir and 15 + 10, base Bolt's cost and total, so the Condemnation and the Sanctum are the gain. |
| Firstfruits Tithe | Enemy characters only, with a per-enemy counter capping it at 3 tithes; the 15 always lands. Lost max HP caps current HP; the ally's max HP rises first, then they heal 10. |
| Shieldbearer's Sweep | Each mark is spent by the first direct hit on its bearer: that damager gains 15 Shield for 1 turn (at most two Shields per Sweep). |
| Call to the Faithful | Consecrates Boulders that aren't Wardstones; only if there are none does it create a Wardstone. |
| Cornerstone Psalm | +10 max HP first, then heal 15. |

### 21.51 Grave (Earth + Unholy)

| Term | Ruling |
|---|---|
| **Graves** | Counter `graves` (max 6) on each Grave character, from the fusion passive `grave_keeper`: +1 on every `died` signal, either side. Simplified: each Grave character keeps their own count, not one per team. |
| **Raise** | Macros `spend_1` / `spend_2` set var `spent`; `raise_spent` summons that many Skeletons (20 HP, Rattle Blade nc 10). Ghoul: 30 HP, Gnaw r 10 + heals 10. Undead are tagged `undead`, and their deaths dig Graves like any other. |
| Tomb Rush | Generic cost −1 per Grave spent on the next skill. |
| Grave Burrower | Simplified: a death before it lands makes it land at once. |
| Open Grave | Checks that the killer carries an Open Grave. |
| Bury Yourself | Spending happens when the Invulnerable turn ends. |
| Ghoul Gravedigger | Works with its creator's Graves. |
| Deathbolt | Fragments spent before the hit; "kills them" = the target is gone afterwards. |
| Marrow Draught | With no allied minion, a Skeleton is summoned first (no Grave). Raw Affliction 10 to every minion; the user heals the HP actually lost. Strategic, since it deals no direct damage. |
| Barrow Stone | Uses `spend_1`; with no Grave, just the 15. |
| Premature Burial | Simplified: the countered skill's cooldown rises by 3, rather than "until a unit dies". |
| Graveside Vigil | An inline Shield of 5 per Grave (max 25) until the end of the user's next turn; nothing if there are no Graves (§21.56). |
| Epitaph | A watcher on the user: when the ally dies, `copyEffects fromSnapshot` gives the user's living allies their Buffs (cond `eventTargetIs`). |
| Bitter Soil | Simplified: each Helpful skill they use while Horrified sprouts a Seedling. |
| Requiem | Value `recentDeaths`: deaths on either side in the last 2 turns. |
| Grudge Beyond the Grave | The Ghoul rises at once and Taunts for 1 turn. |
| Lord of the Grave | Only minions present when it's used become Immortal. |

### 21.52 Moon (Earth + Shadow)

| Term | Ruling |
|---|---|
| **Lunar Cycle** | Fusion passive `lunar_cycle`: counter `phase` (0 New, 1 Waxing, 2 Full, 3 Waning) on each Moon character, advanced at the end of their turns (macro `advance_moon`, which signals `full_moon` / `new_moon`). Named conditions `moon_new` … `moon_waning`. Simplified: each Moon character has their own cycle. "At the start of the Full Moon" = when it's reached at the end of the Moon side's turn. |
| Moonstone Fist | The passive gives Moon Strikes the Stealthy tag at New Moon. |
| Moonfall | Damage reads the phase first; then the phase is set to New without announcing a New Moon (Lunar Lullaby doesn't hear it), and the end-of-turn advance moves it on to Waxing. |
| Turn Beast / Prowl | Held Moon (`face_of_the_moon`) skips the Lunar Cycle's advance while it lasts. Turn Beast sets the phase to Full and signals `full_moon` (not when it's already Full), then holds it at the ends of this turn and the next, so it's Full on the user's next two turns too; Prowl holds it for the current turn. Redesign (2026-10-05): Turn Beast's +10 and heal (half of each direct hit's damage, Shield absorbed included, rounded down) and the Strategic lock are one Buff; the lock is a plain `cannotUseSkills` (Swiftness doesn't lift it). |
| Hunter's Moon | Redesign (2026-10-05): a Hunted debuff on the target counts direct hits from the user's side (minions included) until the shot lands, which reads it and clears it. If the shot is interrupted, Hunted lingers harmlessly until it runs out. |
| Eclipse | Counter `eclipse`: the next advance moves two phases. |
| Moonless Bolt | Blinded for 4 − phase turns. |
| Moon Moths | Simplified: Blinded enemies are Taunted by a Moth for 1 turn. |
| Lunar Lullaby | Lasts 4 − phase turns; at the `new_moon` signal every enemy sleeps 1 turn. |
| Silver Severance | Simplified: Isolated for 2 turns. |
| Lunacy | Redesign (2026-10-05): the random ally can be a minion. Both get a Shared Dream (`shared_dream`) before the Sleep; damage that wakes a sleeping dreamer ends the Sleep and the Dream on everyone of their side sharing it. A dreamer whose Sleep was negated (Swiftness) doesn't wake the other. |
| Borrowed Moonlight | Raw HP loss, never below 1. |
| Moonveil | Sleep, Invulnerable and the wake-up timer all last through the ally's next turn; then the Might and Renew land. |
| Tidal Lock | Applied at the end of the user's turns, for the enemy's next turn. |
| Shattered Crescent | Redesign (2026-10-05): the same Moonshard as the Shot's, one in each of the target's allies (minions included); it lasts long enough to reach the next Full Moon from any phase, and stacks with other shards. |
| Face of the Moon | Redesign (2026-10-05): each direct hit from an enemy Blinds the attacker for 2 turns and gives them Moonglare for as long: while they're Blinded (from any source), their direct damage to a unit under the Face of the Moon is 10 lower (not Armor, so Piercing doesn't skip it). |
| Cairn Ward | Inline Shield; the Boulder is summoned at 45 HP and loses the difference. |
| Wandering Light | The passed Taunt lasts 1 turn. |

### 21.53 Zealot (Holy + Unholy)

| Term | Ruling |
|---|---|
| **Fervor** | Buff, merging, max 5: +5 direct damage per stack to Zealot-element skills (modifier `elements` filter). +1 when an enemy hits the bearer directly or gives them a Debuff. Simplified: the +5 healing per stack isn't implemented. |
| **Martyr** | Fervor's `onDeath` (new effect hook, run before channels are interrupted): the fallen unit's allies heal 10 per stack and gain 1 Might per 2 (permanent). |
| Crusader's Wrath | Fervor is spent before the hits, so its own bonus doesn't also apply. |
| Fanaticism | Debuffs from enemies are removed as they land, each giving 1 Fervor. |
| Martyr's Spear | Every enemy damage event on the user while channeling counts (Affliction and Mark hits included), up to 3. The landing hit is indirect, so Fervor doesn't add to it. |
| Inquisition | Redesign (2026-10-05): a hidden Debuff for 3 turns counts every skill the target uses (Helpful ones too, countered ones too) and gives the user 1 Fervor for each (to Fervor's cap of 5). It runs out as the target's third turn ends: 5 indirect damage per skill counted. Removed early, nothing lands. |
| Hair Shirt | Damage taken ×0.5. With Fervor, a hit gives Fervor's own +1 and 1 more; without, 2. |
| Flagellant | Blood Whip's +5 per Fervor comes from Fervor itself. |
| Harrowing Nova | "Above half" = HP greater than missing HP, checked before and after each hit. |
| Initiate | Take the Blow is a Ward (counts as Warded) from the Initiate, bound to it. |
| Living Saint | Macro `martyr_payout`: the user's other allies get the payout. |
| Atoning Blade | Redesign (2026-10-05, fix 3): the Debuff moves (`stealRandom`) after the hit, keeping its stacks and time left; with no Debuff it's just the hit. Fervor's own bonus adds to the 15. |
| Zealous Unction | Heals at the end of each of the user's turns, the one it's used on included (3 heals). |
| Communal Grace | Simplified: only this target's Sanctify. |
| Fervent Chant | Status `fervent_chant` until the user's next turn: an `onDeath` payout as for 3 Fervor. |
| Heretics' Circle | Simplified: if the target has any Debuff, each other enemy with any Debuff takes 15. |
| Sermon of Dread | A Buff gained or refreshed is removed as it lands (as under Fanaticism); Buffs they already had stay. |
| Hardened Faith | Redesign (2026-10-05, was Shield of Martyrs): each direct enemy hit, even one a Shield took, adds a separate 15 Shield after it lands. Gained on the enemy's turn, each lasts through their next turn as well. |
| Strike Me Down | Any killer of the user takes the damage. |

### 21.54 Vigilante (Holy + Shadow)

| Term | Ruling |
|---|---|
| **Exposed** | Debuff: `immuneToEffects` Stealth, Invulnerable, Untargetable (any it has end when Exposed lands), and the Invisible effects it owns are revealed (`reveal by`). Vigilante-element skills deal +10 direct damage to it (`damageTaken` now honours the modifier `elements` filter). |
| Watcher in the Dark | The kit's "Guardian in the Dark", renamed: "Guardian" is a retired word the content lint rejects. |
| Street Justice | Simplified: Exposed first if the target was the last enemy to damage the user. |
| Round Up the Gang | Simplified: 25 to each other enemy carrying any Buff. |
| Tip Off | Next skill Stealthy via `skillTags`, until a skill is used. |
| Pursuit | Checks the user's Stealth as it's used; Pursuit isn't Stealthy, so that Stealth then ends. |
| Caught Red-Handed | Redesign (2026-10-05, fix 3): the watch sits on each of the user's allies but not the user (minions included). The first Harmful skill an enemy uses on any of them, an attack on the whole side included, is countered and every copy of the watch ends; its user is Exposed for 2 turns. |
| The Hunt Begins | The +5 looks at Exposed as each hit lands, so the hit that Exposes a target doesn't get it. |
| Searchlight | Untargeted; selector `randomAnyEnemy` (Stealthed included). Simplified: only Stealth (not Invisible effects) triggers the Exposure. |
| From the Rooftops | A hidden watcher counts Stealth gained and Invisible skills used during the channel. |
| Sting Operation | New trigger filter `anyTags` for intercepting skillUsed. |
| Safe Passage | `cannotUseSkills harmful` for 3 ticks (through the user's next turn). |
| Bloodhound's Scent | Exposed bound to the Bloodhound; a new Scent ends the previous one. |
| Floodlight | Hits every enemy, Stealthed ones included; only Stealth or Invulnerable cause the Exposure. |
| Cover Fire | "Acted" means used a skill this turn (`actedThisTurn`); an ally who acts after it loses the Stealth as usual unless that skill is Stealthy. |
| Shakedown | `stealRandom` Buff; the 15 heal only when they had no Buff. |
| Night Patrol | Enemies are watched (counter `patrolled` = turn of their last Harmful skill). |
| Witness Statement | The 10 to the culprit is indirect (the skill is Strategic), so Exposed doesn't add to it; the heal counts the whole hit, Shield included. A dead last attacker counts as none. |
| Quiet Verdict | A hidden Debuff; the damage is indirect (no Exposed bonus) and HP is checked when it lands. Using it still ends the user's Stealth. |
| Setup | Counter → Condemned + `setup_watch` (2 turns): an ally of theirs who gives them a Buff is Exposed. |
| Mask On | +10 as a follow-up hit, not direct. |
| Full Sentence | Redesign (2026-10-05): restitution is paid after each Harmful skill of theirs resolves (a countered one pays nothing), healing each of its targets (not splash victims). |
| Sweep the Streets | "Other Exposed" leaves out the target. |
| Hue and Cry | Reaches every enemy unit, Stealthed ones included. Redesign (2026-10-05): the Condemn lands after their first Harmful skill resolves, so it's set off by their next skill, not that one. |
| Reinforced Trenchcoat | `boostShields −10` per Debuff prevented. |
| Nightwarden | `invulnerableTo` units carrying Exposed, from any source; any enemy damage to the user Exposes its source. |

### 21.55 Curse (Unholy + Shadow)

| Term | Ruling |
|---|---|
| **Hexes** | Debuffs `hex_pain` (10 Affliction to the bearer whenever they deal direct damage), `hex_silence` (Strategic skills cost 1 more generic energy), `hex_ruin` (10 Affliction whenever they gain a Buff). Named condition `hexed`. |
| **Lingering** | New effect flag `lingers`: when the effect is removed (a cleanse; moves don't count) or its bearer dies, it's re-applied to a random living ally of the bearer with its remaining duration. Expiring or being consumed (`removeStacks`) doesn't Linger. |
| Woeblade | Simplified: a random Hex (no "last skill" tracking). |
| Crushing Malediction | (Redesigned 2026-10-05.) A Debuff beside the Pain echoes it: each direct hit the target deals while they still have Hex of Pain deals 10 Affliction to each of their allies. If the Pain is cleansed and Lingers, the echo stays behind. |
| Crossed Path | (Was Somnambulant Rush; redesigned 2026-10-03.) The rider waits for the user's next Harmful skill and gives a random Hex to each enemy among its targets; the Charge's own hit doesn't count. |
| Hex Ward | Counters every Harmful skill from a Hexed enemy all turn, plus the first from anyone else (§21.56). |
| Cursed Hunger | +5 direct damage per Hexed enemy (max 3), counted as each hit lands. |
| Doom | Hexes are consumed (no Lingering), +15 each. |
| Cleanser's Snare | Simplified: it springs when the Snare itself is cleansed (a hidden watcher on the user, `ownEffectEnded reason removed`). |
| Wretched Haven | (Was Familiar's Cover; redesigned 2026-10-05.) Invulnerable is applied before the Hexes, so Ruin doesn't punish it. The Hexes are the user's own and Linger like any other. |
| Malediction | 10 Affliction per Buff the target has, at once. |
| Hex Shade | Simplified: Whisper gives a random Hex for 2 turns. |
| Cursed Dagger | (Redesigned 2026-10-05.) The Hex is picked uniformly among those the user has and moved before the hit, so a passed Pain doesn't hurt the user for it. A move isn't a cleanse: nothing Lingers. |
| Tongue-Tied | Simplified: counters their next Harmful skill, Hexed or not. |
| Evil Eye | Counter `evil_eyed` marks who has had it; the chain passes at each natural expiry. |
| Envious Jig | Copies use `copyEventEffect noChain`; the enemy's Buff loses 2 ticks. |
| Pass the Curse | Simplified: all their Debuffs move to one random enemy. |
| Blind Man's Toll | Simplified: each skill they use while Blinded. It Blinds the target itself for 1 turn (redesigned 2026-10-03), so the Toll pays at least once on its own. |
| Vespers of Slumber | `hpFloor 1` while it lasts; reaching 1 HP puts them to Sleep and ends it. |
| Shrouded Ward | (Redesigned 2026-10-03.) A watcher beside its own Shield Blinds each enemy whose direct hit lands while the Shield holds, including the hit that breaks it, then ends with the Shield. |
| Geas | (Was Poppet; redesigned 2026-10-05.) The target's Hex comes first; then every enemy carrying any Hex, from anyone, is Taunted by the user for 1 turn. An Immune target gets no Hex, so isn't Taunted unless already Hexed. |
| Grudging Cut | (Was Spreading Dread, Sow Discord, then Wicked Sweep; redesigned 2026-10-05, final round.) After the 20, the other enemy with the most HP (minions count) takes half of (their HP − the target's HP), rounded down, at least 5 and at most 25, as direct Affliction. With a tie, only the first in unit order is hit. A slain target counts as 0 HP. |
| Ill Wind | (Redesigned 2026-10-05.) Intimidated lands after the Strategic skill that sets it off, so that skill isn't slowed. |
| The Accursed | (Redesigned 2026-10-05.) Direct hits only. Counts every Hex the attacker carries as the hit lands, from anyone; the 10 per Hex is indirect, and Hex of Pain still bites on its own. |

### 21.56 Rulings from the fusion test pass

Engine and content rulings made while fixing what the spec-driven fusion tests found. Where an earlier §21
row disagrees, this section wins.

| Topic | Ruling |
|---|---|
| Counters | A counter's effect sees the countered skill (its cost, cooldown and archetype) and the units it targeted. `when.archetypes` limits which skills a counter catches. |
| Stealthy | Stealth checks the skill's effective tags, so a Buff that makes skills Stealthy keeps Stealth. |
| Mimic | "The skill that killed / broke / stunned it" is the skill the attacker is using at that moment. |
| Condemned riders | Condemned records the turn it fires (named condition `condemn_fired`); "when their Condemned triggers" riders check it once the skill resolves. |
| Purifying (tag) | A Condemned user isn't punished for using a Purifying skill: the Condemnation is spent with no Debuff. No skill carries the tag since Phoenix's Anointed Ascent became Into the Ashes (2026-10-05). |
| Shield riders | A hit on a Shield is heard by the bearer's other effects too ("when their Shield breaks…"). |
| Catalyst | A Catalyst applied by a skill waits for the next skill; re-applying a spent Catalyst re-arms it for the next one. |
| Late durations | Turn-based durations granted while end-of-turn expiries resolve are one tick shorter (they missed that turn's countdown), so "for N turns" lasts N turns. |
| "Until the end of their next turn" | Anointed, Chrism and Exalted grants use `ownTurns: 1`, so they end with the recipient's next turn whichever turn they're granted on. |
| Pilgrim's Rush | Its Chrism lasts until the end of the user's next turn, so the Focus rider can happen. |
| Taunt | Absolute: a Taunted unit's single-target Harmful skills must target its taunter. If the taunter can't be targeted (Stealth, Dormant, Untargetable), there's no legal target; area skills still work. Feigned Sleep and Whisper from the Dark rely on this. |
| Hidden effects | A hidden effect's start- and end-of-turn checks don't reveal it; it's revealed when it reacts to something. |
| Death Mark | The +10 is Piercing (a strike at a marked weak point), so Armor doesn't absorb it. |
| Unseen Knife | Blinded or Sleeping is checked before the hit, which wakes a Sleeper. |
| Long Diagnosis | Its skill counter outlasts the channel. |
| Coldsnap Dash | The crack rider lasts through the user's next turn. |
| White Flame Waltz | Only direct damage counts as "dealt damage" (its own Explosion doesn't). |
| Jump Start | The −2 generation lasts until the end of the player's next turn, so it applies to that generation. |
| Dread Lunge | The target counts as Horrified until the end of the user's next turn. |
| Invisible skills | Everything an Invisible skill applies is hidden from the opponent (like a hidden effect) until it reacts or ends. A status marked `visibility: public` stays visible (Fog; Warning Colors III). Sinking Sands' Trap is therefore hidden. |
| Bloodbound Familiar | New modifier `hpLink`: damage and healing aimed at it go straight to its summoner (full amounts); it dies when they do. |
| Blood Elemental | Its current HP rises with its max HP (HP equal to what was paid). |
| Blood Price | Locked at queue time: a skill whose random cost was paid in energy isn't charged HP on top. |
| Blood Chant | Lasts until the end of the user's next turn, so allies benefit on that turn. |
| Arterial Strike | The healer takes the Hemorrhage as it stands (its current stacks), handed over by Hemorrhage's own "healing removes it". |
| dealtDamage events | Carry the HP the hit removed, so "heals for the damage dealt" riders work (Brimfire Crest, Karmic Debt…). |
| Asphyxiate | `cannotUseSkills evenUnstunnable`: it stops Unstunnable skills too. |
| Crystal Cocoon | Counter `c:hit_capped` marks a hit that a per-hit cap reduced; each such enemy hit gives its dealer 1 Brittle. |
| Live Wire | Its 15 is indirect (no Conductor bonus, no conduct). The jump goes to a random other enemy (minions included), stays hidden, and lasts 2 more enemy turns; the jumped wire can't jump again. |
| Still Spring | Renew doesn't lose stacks while the bearer has Still Spring (checked in Renew itself). |
| Hex Ward | Per the description: every Harmful skill from a Hexed enemy is countered all turn (`when.sourceIs: hexed`), plus the first from anyone else. |
| Shrouded Ward | Stealthy itself. |
| Hellraze | When the Contract ends, the bearer loses their Buffs, then pays 10 Affliction per Buff they had (borrowed power). |
| Entangled | A death breaks only the fallen unit out of the link; the survivors stay Entangled while at least two remain. |
| Void Brand | `exposed total`: the brander's side can target the bearer past Stealth, Untargetable and Invulnerable. |
| Faceless Void | Entangles the user with their other ally with the least HP (selector `weakestOtherAlly`). |
| Ascend | "They" is the target: a Sanctified target's Sanctify is spent and the user Exalted; otherwise the target is Sanctified (setting up the next Ascend). |
| isEventTarget | For single-target events (damage, healing, signals) it checks the event's one target. |
| Take You With Me | The doom lasts until the end of the user's next turn. |
| Gilded Bait | The Buff that springs it is removed outright. |
| Skyfall Breath | Costs Sr, as in the kit. |
| Borrowed Blood | The cast turn doesn't count: the ally's next 2 turns do. |
| Lord of Souls | A Tithe gets nothing while the user can't spend Fragments. |
| Brood Parasite | The Host mark comes from the Parasite, so it dies with its own host. |
| Moving effects | Protected effects can't be moved (`protectEffects`, e.g. Mammoth's Chill). |
| Dust Storm | Each enemy is Charmed until their next skill, for up to 2 turns. |
| Swiftness and countsAs | Negation also catches effects that count as the negated status (Enchanted Slumber counts as Sleep). |
| Fey Mark | Forward-looking: for 1 turn, each ally of the target who uses a Helpful skill on them is Charmed for 1 turn. |
| Gossamer Veil | Each enemy who hits its Shield is Charmed for 1 turn. |
| Fickle Heart | Taunted by one of their own allies, the enemy's single-target Harmful skills may (and must) target that ally. |
| skillTargeted events | Carry the skill and its target list (single-target checks). |
| Haunt drift | A Haunt only drifts to an un-Haunted ally of the bearer (named condition `ghost_haunted`), so split Haunts don't merge; with none, it stays. |
| Restless Dead | Gives a Soul Fragment only when the Haunt actually drifts. |
| Thin Ice | Redesign (2026-10-05, final round): the user's Icebound (3 turns) and the hidden counter on the target (3 of their turns) are separate effects, so cleansing the user's Icebound early doesn't end the counter. It counters the target's first Harmful skill in that window (its cooldown still starts), then ends every Icebound on the user and gives them Meltwater for 1 turn. Unused, both just run out. |
| Graveside Vigil | Its Shield lasts until the end of the user's next turn, so re-using it while it holds digs a Grave first. |
| Seeker Spark | Ends the Stealth first, then strikes. |
| Hoarded Life | Its payout watcher outlives the Shield, so the Phylactery is fed when the Shield ends. |
| Strangling Roots | Re-casting refreshes it; only the bearer's own skills tighten it. |
| Tangleweed | `targetExclude singleOnly`: they can't aim single-target skills at the minions, but area skills still hit them. |
| Call of the Grove / Warden Oak | Every allied Seedling counts, whoever made it. |
| Mass Driver | Launches for 20 + the Boulder's own remaining HP. |
| Offload | Every ally, Isolated ones included (it doesn't target them). |
| Mirrored Mending | The watch lasts 2 turns. |
| Voice in the Fog | New modifier `lured`: the bearer's single-target Harmful skills land on the user at resolution, whoever they aimed at (invisible until it happens). |
| Wards | Several copies of one Ward (a Substitution from each Clone) redirect once per turn in all. |
| Flurry | Hits every enemy the skill hit directly (splash included), once each, even if Armor stopped the hit (counter `hit_in_use`, value `useSeq`). |
| Ninken Track | Untargeted (cooldown 2): every enemy loses Stealth and can't gain it for 1 turn. |
| Lunar Lullaby | The New Moon is announced before that turn's tick, so the last tick lands with the Sleep. |
| Mammoth Charge / Dawn Chorus | Values about the loop's unit are captured before hitting another unit. |
| Mammoth | Its protecting Chill is Neutral, so a cleanse can't strip it first. |
| Giant-Slayer | A kill gives 1 more Legend on top of Saga's own. |
| Awakened Giant | Earns no Legend itself (it spends them); it counts the Legends the user had. |
| Midnight | From Dusk's countdown, Frozen Sleep costs the bearer the turn that's starting; struck any other way (False Dawn…), it costs their next turn. |
| Counting effects | A listed effect counts once; one that only counts as listed keys counts once per key (Frozen Sleep counts as three Frost debuffs for Rimecut). |
| Keeping Stealth | A "keep your Stealth" effect gained during a skill counts for that skill too. (Hidden Moon used to rely on it; since 2026-10-03 it gives the user a fresh Stealth instead.) |
| Frostfall Cloak | The breaking hit itself grants the Stealth (1 turn per Frost debuff on the breaker, max 3). |
| Waterskin | The 35 needs a skill actually used since the user's last turn (not the match start). |
| Silent triggers | A hidden effect's `silent` reaction doesn't reveal it (Sinking Sands growing with Trek). |
| The Long Road | `keepChannels`: the user's other skills (which raise Trek) don't end it. |
| Ritual Knife | 25 only when this use completes the Rite. |
| Living Temple | Counts as a Wardstone everywhere (named condition `counts_as_wardstone`), Penance in Stone included. |
| Drip | Ends when its target Overdoses (it listens for the Overdose). |
| Split | The new Ooze takes half (rounded down); the old one keeps the rest. |
| linkTo | Looks for the effect on the actor, then on the bearer of the effect running it (Fertile Silt's Might lasts as long as the Silt). |
| Tainted Hands | Every ally of the bearer the Helpful skill affects gains a Spore. |
| Martyr | Fervor is counted as the payout starts (the fatal hit's +1 doesn't count). |
| Fanaticism | A prevented Debuff gives exactly 1 Fervor (Fervor's own +1 is skipped under Fanaticism). |
| Eye of the Storm | Empowers the next Storm skill, not the one that brought Tempest to 5 (counter `eye_use`). |
| Sunspot | The user's Corona lasts 2 turns longer. |
| Searchlight / Floodlight | Untargeted, so they can be used when every enemy is Stealthed. |
| Night Patrol | Only enemies who actually used a Harmful skill are hit. |
| Archetype counters | A counter that names archetypes (or tags) catches matching skills whether Harmful or not (Snare of Frost, Sabotage). |
| Snowslide | Landing spends the Leap. |
| Carrion Stench | "Them" is the user: hits on the user deal 10 less, and the user can't be healed. |
